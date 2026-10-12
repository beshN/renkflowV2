import XCTest

final class FieldLaunchTests: XCTestCase {
    func testNativeLoginAndAccessibility() {
        let app = XCUIApplication(); app.launchArguments = ["--reset-session"]; app.launch()
        XCTAssertTrue(app.staticTexts["Hoş geldiniz"].waitForExistence(timeout: 10))
        let login = app.buttons["Giriş yap"]
        XCTAssertTrue(login.exists); XCTAssertFalse(login.isEnabled)
        XCTAssertTrue(app.secureTextFields["Şifreniz"].exists)
        let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Renkflow-Saha-iOS-Login"; screenshot.lifetime = .keepAlways; add(screenshot)
    }
}
