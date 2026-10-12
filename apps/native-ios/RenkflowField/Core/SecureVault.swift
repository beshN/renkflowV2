import Foundation
import Security

final class SecureVault {
    private let service = "com.renkflow.field"
    func read<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: name, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let bytes = result as? Data else { return nil }
        return try? JSONDecoder().decode(type, from: bytes)
    }
    func save<T: Encodable>(_ name: String, value: T) throws {
        let bytes = try JSONEncoder().encode(value)
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: name]
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: bytes] as CFDictionary)
        if status == errSecItemNotFound {
            var insert = query; insert[kSecValueData as String] = bytes
            insert[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else { throw FieldAPIError(status: 0, message: L("text_guvenli_kayit_olusturulamadi_a8f69")) }
        } else if status != errSecSuccess { throw FieldAPIError(status: 0, message: L("text_guvenli_kayit_guncellenemedi_4a8d4")) }
    }
    func remove(_ name: String) { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: name] as CFDictionary) }
    func clear() { remove("session"); remove("pending") }
}
