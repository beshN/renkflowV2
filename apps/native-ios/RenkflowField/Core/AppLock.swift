import Foundation
import LocalAuthentication
import Combine
@MainActor final class AppLock:ObservableObject {
    @Published private(set) var enabled=UserDefaults.standard.bool(forKey:"field-lock")
    @Published private(set) var unlocked=false
    @Published var message:String?
    private var authenticating=false
    func lock() {if enabled {unlocked=false}}
    func disable() {enabled=false;unlocked=true;UserDefaults.standard.set(false,forKey:"field-lock")}
    func unlock(enable:Bool=false) async {
        guard !authenticating else {return};authenticating=true;defer {authenticating=false}
        let context=LAContext();var error:NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication,error:&error) else {message=L("text_bu_cihazda_guvenli_kilit_hazir_degil_sistem_ayar_c7d34");return}
        do {
            guard try await context.evaluatePolicy(.deviceOwnerAuthentication,localizedReason:L("text_renkflow_saha_kayitlarini_acin_db406")) else {return}
            if enable {enabled=true;UserDefaults.standard.set(true,forKey:"field-lock")};unlocked=true;message=nil
        } catch {message=L("text_kilit_acilamadi_yeniden_deneyebilirsiniz_b1567")}
    }
}
