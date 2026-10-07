package com.renkflow.field

import android.graphics.Bitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.renkflow.field.data.*
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

@RunWith(AndroidJUnit4::class)
class FieldDeviceTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()
    @Test fun nativeLoginRequiresCredentialsAndHasAccessibleInputs() {
        compose.onNodeWithText("Hoş geldiniz").assertIsDisplayed()
        compose.onNodeWithText("E-posta").assertExists()
        compose.onNodeWithText("Şifre").assertExists()
        val file = File(compose.activity.getExternalFilesDir(null), "screenshots/android-login.png")
        file.parentFile!!.mkdirs()
        file.outputStream().use { compose.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) }
        compose.onNodeWithText("Giriş yap").performScrollTo().assertIsNotEnabled()
    }
    @Test fun keystorePersistsSessionAndReplayIdentityWithoutPlaintextCredentials() {
        val context = compose.activity
        val vault = Vault(context)
        vault.clear()
        val user = User("test-user", "field@example.invalid", "Operator", "worker", "test-company")
        val session = Session("https://renkflow.com", "test-token-never-plaintext", Long.MAX_VALUE, user)
        val command = Command("00000000-0000-4000-8000-000000000001", data = OperationInput("operation", 4, "complete", 2))
        vault.saveSession(session); vault.savePending(command)
        val restored = Vault(context)
        assertEquals(session, restored.session()); assertEquals(command, restored.pending())
        val raw = context.getSharedPreferences("field_vault", 0).all.values.joinToString()
        assertFalse(raw.contains(session.token)); assertFalse(raw.contains(command.commandId))
        restored.clearPending(); assertNull(restored.pending()); restored.clear(); assertNull(restored.session())
    }
}
