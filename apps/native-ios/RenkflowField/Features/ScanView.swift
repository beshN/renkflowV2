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
                SectionTitle(title: L("text_etiketten_ise_84575"), caption: L("text_qr_ve_barkodlari_kamerayla_okutun_109c6"))
                VStack(spacing: 24) {
                    Image(systemName: "qrcode.viewfinder").font(.system(size: 100, weight: .light)).foregroundStyle(FieldColor.onInk)
                    Text(L("text_malzeme_lot_is_emri_92ca4")).font(.headline).foregroundStyle(.white)
                    Button(L("text_kamerayi_ac_837ff")) { scanning = true }.buttonStyle(FieldButton(bright: true)).disabled(store.busy)
                }.padding(32).frame(maxWidth: .infinity).background(FieldColor.ink, in: RoundedRectangle(cornerRadius: 12))
                TextField(L("text_etiket_kodu_veya_qr_icerigi_0843b"), text: $code).textInputAutocapitalization(.never).autocorrectionDisabled().fieldInput().onSubmit { Task { await store.scan(code) } }
                Button(L("text_kodu_bul_172a4")) { Task { await store.scan(code) } }.buttonStyle(.bordered).controlSize(.large).disabled(code.isEmpty || code.count > 1000 || store.busy)
                if let result = store.scanResult {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(["job": L("text_is_emri_10fe2"), "item": L("text_malzeme_97571"), "lot": L("text_lot_23ea1"), "location": L("text_konum_cc8b7"), "product": L("text_mamul_d803c"), "cut": L("text_kesim_paketi_52395")][result.kind] ?? L("text_etiket_bc91f")).font(.caption.bold()).foregroundStyle(FieldColor.accent)
                        Text(result.title).font(.title2.bold())
                        if let subtitle = result.subtitle { Text(subtitle) }
                        if let amount = result.quantity { Text("\(quantity(amount)) \(result.uom ?? "")") }
                        if let id = result.workOrderId { Button(L("text_is_emrini_ac_516de")) { Task { await store.openJob(id) } }.buttonStyle(FieldButton()) }
                    }.padding(24).frame(maxWidth: .infinity, alignment: .leading).background(FieldColor.card, in: RoundedRectangle(cornerRadius: 12))
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
                FieldColor.ink.ignoresSafeArea()
                if authorized {
                    NativeScanner(result: result) { denied = true; authorized = false }.ignoresSafeArea(edges: .bottom)
                    VStack { Spacer(); Text(L("text_etiketi_kameraya_gosterin_fced3")).font(.headline).foregroundStyle(.white).padding(18).background(.black.opacity(0.65), in: Capsule()).padding(.bottom, 36) }
                } else if denied {
                    VStack(spacing: 20) {
                        Image(systemName: "camera.fill").font(.largeTitle)
                        Text(L("text_kamera_kullanilamiyor_3a012")).font(.title2.bold())
                        Text(L("text_ayarlardan_kamera_iznini_acin_veya_etiket_kodunu_4bf61")).multilineTextAlignment(.center)
                        Button(L("text_ayarlari_ac_4de5a")) { if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } }.buttonStyle(.borderedProminent)
                    }.padding(28).foregroundStyle(.white)
                } else { ProgressView().tint(FieldColor.onInk) }
            }.navigationTitle(L("text_etiket_tara_658b9")).navigationBarTitleDisplayMode(.inline)
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
    required init?(coder: NSCoder) { fatalError(L("text_init_coder_is_not_supported_301be")) }
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
