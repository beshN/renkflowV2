import SwiftUI
import AVFoundation
import UIKit

struct ScanView: View {
    @EnvironmentObject private var store: FieldStore
    @State private var scanning = false
    @State private var code = ""
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionTitle(title: "Etiketten işe", caption: "QR ve barkodları kamerayla okutun")
                VStack(spacing: 24) {
                    Image(systemName: "qrcode.viewfinder").font(.system(size: 100, weight: .light)).foregroundStyle(FieldColor.lime)
                    Text("Malzeme · Lot · İş emri").font(.headline).foregroundStyle(.white)
                    Button("Kamerayı aç") { scanning = true }.buttonStyle(FieldButton(bright: true)).disabled(store.busy)
                }.padding(32).frame(maxWidth: .infinity).background(FieldColor.pine, in: RoundedRectangle(cornerRadius: 28))
                TextField("Etiket kodu veya QR içeriği", text: $code).textInputAutocapitalization(.never).autocorrectionDisabled().fieldInput().onSubmit { Task { await store.scan(code) } }
                Button("Kodu bul") { Task { await store.scan(code) } }.buttonStyle(.bordered).controlSize(.large).disabled(code.isEmpty || code.count > 1000 || store.busy)
                if let result = store.scanResult {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(["job": "İş emri", "item": "Malzeme", "lot": "Lot", "location": "Konum", "product": "Mamul", "cut": "Kesim paketi"][result.kind] ?? "Etiket").font(.caption.bold()).foregroundStyle(FieldColor.teal)
                        Text(result.title).font(.title2.bold())
                        if let subtitle = result.subtitle { Text(subtitle) }
                        if let amount = result.quantity { Text("\(quantity(amount)) \(result.uom ?? "")") }
                        if let id = result.workOrderId { Button("İş emrini aç") { Task { await store.openJob(id) } }.buttonStyle(FieldButton()) }
                    }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 20))
                }
            }.padding(24).fieldCanvas()
        }.background(FieldColor.background).scrollDismissesKeyboard(.interactively)
            .sheet(isPresented: $scanning) { ScannerSheet { value in scanning = false; code = value; Task { await store.scan(value) } } }
    }
}

struct ScannerSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var authorized = false
    @State private var denied = false
    let result: (String) -> Void
    var body: some View {
        NavigationStack {
            ZStack {
                FieldColor.pine.ignoresSafeArea()
                if authorized {
                    NativeScanner(result: result) { denied = true; authorized = false }.ignoresSafeArea(edges: .bottom)
                    VStack { Spacer(); Text("Etiketi kameraya gösterin").font(.headline).foregroundStyle(.white).padding(18).background(.black.opacity(0.65), in: Capsule()).padding(.bottom, 36) }
                } else if denied {
                    VStack(spacing: 20) {
                        Image(systemName: "camera.fill").font(.largeTitle)
                        Text("Kamera kullanılamıyor").font(.title2.bold())
                        Text("Ayarlar’dan kamera iznini açın veya etiket kodunu elle girin.").multilineTextAlignment(.center)
                        Button("Ayarları aç") { if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } }.buttonStyle(.borderedProminent)
                    }.padding(28).foregroundStyle(.white)
                } else { ProgressView().tint(FieldColor.lime) }
            }.navigationTitle("Etiket tara").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Kapat") { dismiss() } } }
                .task {
                    switch AVCaptureDevice.authorizationStatus(for: .video) {
                    case .authorized: authorized = true
                    case .notDetermined: authorized = await AVCaptureDevice.requestAccess(for: .video); denied = !authorized
                    default: denied = true
                    }
                }
        }
    }
}

struct NativeScanner: UIViewControllerRepresentable {
    let result: (String) -> Void; let unavailable: () -> Void
    func makeUIViewController(context: Context) -> ScannerController { ScannerController(result: result, unavailable: unavailable) }
    func updateUIViewController(_ controller: ScannerController, context: Context) {}
    static func dismantleUIViewController(_ controller: ScannerController, coordinator: ()) { controller.stop() }
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    private let capture = AVCaptureSession()
    private let queue = DispatchQueue(label: "com.renkflow.field.camera")
    private let result: (String) -> Void
    private let unavailable: () -> Void
    private var preview: AVCaptureVideoPreviewLayer?
    private var delivered = false
    private var stopped = false
    init(result: @escaping (String) -> Void, unavailable: @escaping () -> Void) { self.result = result; self.unavailable = unavailable; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        guard let camera = AVCaptureDevice.default(for: .video), let input = try? AVCaptureDeviceInput(device: camera), capture.canAddInput(input) else { unavailable(); return }
        capture.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard capture.canAddOutput(output) else { unavailable(); return }
        capture.addOutput(output); output.setMetadataObjectsDelegate(self, queue: .main)
        let supported: [AVMetadataObject.ObjectType] = [.qr, .code128, .code39, .ean13, .ean8, .pdf417, .dataMatrix, .aztec]
        output.metadataObjectTypes = supported.filter { output.availableMetadataObjectTypes.contains($0) }
        let layer = AVCaptureVideoPreviewLayer(session: capture); layer.videoGravity = .resizeAspectFill; view.layer.addSublayer(layer); preview = layer
        queue.async { [weak self] in guard let self, !self.stopped else { return }; self.capture.startRunning() }
    }
    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews(); preview?.frame = view.bounds
        if let connection = preview?.connection, connection.isVideoRotationAngleSupported(90) { connection.videoRotationAngle = 90 }
    }
    func stop() { queue.async { [weak self] in self?.stopped = true; self?.capture.stopRunning() } }
    override func viewDidDisappear(_ animated: Bool) { super.viewDidDisappear(animated); stop() }
    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !delivered, let code = metadataObjects.compactMap({ ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }).first else { return }
        delivered = true; stop(); UIImpactFeedbackGenerator(style: .medium).impactOccurred(); result(code)
    }
}
