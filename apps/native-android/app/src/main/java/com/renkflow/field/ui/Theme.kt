package com.renkflow.field.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val Pine = Color(0xFF112D32)
val Lime = Color(0xFFC6F36A)
val Teal = Color(0xFF27685D)
val Clay = Color(0xFFAF5535)
@Composable fun FieldTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) darkColorScheme(
        primary = Lime, onPrimary = Pine, secondary = Color(0xFF9ED1C1), background = Color(0xFF0D2024),
        surface = Color(0xFF142E32), surfaceVariant = Color(0xFF213C3F), onSurface = Color(0xFFE9EEE7), onSurfaceVariant = Color(0xFFBCCBC5)
    ) else lightColorScheme(
        primary = Teal, onPrimary = Color.White, secondary = Teal, background = Color(0xFFF4F5EF),
        surface = Color.White, surfaceVariant = Color(0xFFE7EBE4), onSurface = Pine, onSurfaceVariant = Color(0xFF657873)
    )
    MaterialTheme(colorScheme = colors, typography = Typography(
        headlineLarge = TextStyle(fontWeight = FontWeight.Bold, fontSize = 34.sp, letterSpacing = (-1).sp),
        headlineMedium = TextStyle(fontWeight = FontWeight.Bold, fontSize = 27.sp, letterSpacing = (-0.5).sp),
        titleLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 21.sp),
        titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp), bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
        labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    ), content = content)
}
