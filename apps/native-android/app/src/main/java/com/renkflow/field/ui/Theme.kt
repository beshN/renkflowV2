package com.renkflow.field.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.dp

// Matches apps/web/styles/theme.css; platform fonts and controls stay native.
val Ink = Color(0xFF111113)
val OnInk = Color.White
val Cobalt = Color(0xFF2F55F4)
@Composable fun FieldTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) darkColorScheme(
        primary = Color(0xFF6B8FF0), onPrimary = Ink, secondary = Color(0xFF6B8FF0),
        background = Color(0xFF0B0B0C), onBackground = Color(0xFFECECEE),
        surface = Color(0xFF121214), surfaceVariant = Color(0xFF161618),
        onSurface = Color(0xFFECECEE), onSurfaceVariant = Color(0xFF9A9AA3),
        outline = Color(0xFF626269), outlineVariant = Color(0xFF26262A),
        tertiary = Color(0xFF4ADE80), error = Color(0xFFF87171),
        secondaryContainer = Color(0xFF19223F), onSecondaryContainer = Color(0xFFDFE7FC)
    ) else lightColorScheme(
        primary = Cobalt, onPrimary = Color.White, secondary = Cobalt,
        background = Color(0xFFFBFBFB), onBackground = Ink,
        surface = Color.White, surfaceVariant = Color(0xFFF4F4F5),
        onSurface = Ink, onSurfaceVariant = Color(0xFF6B6B73),
        outline = Color(0xFF8A8A92), outlineVariant = Color(0xFFE4E4E7),
        tertiary = Color(0xFF15803D), error = Color(0xFFDC2626),
        secondaryContainer = Color(0xFFEFF3FE), onSecondaryContainer = Color(0xFF10245F)
    )
    MaterialTheme(colorScheme = colors, shapes = Shapes(
        extraSmall = RoundedCornerShape(4.dp), small = RoundedCornerShape(8.dp),
        medium = RoundedCornerShape(10.dp), large = RoundedCornerShape(12.dp), extraLarge = RoundedCornerShape(16.dp)
    ), typography = Typography(
        headlineLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 34.sp, letterSpacing = (-1).sp),
        headlineMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 27.sp, letterSpacing = (-0.5).sp),
        titleLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 21.sp),
        titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp), bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
        labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
    ), content = content)
}
