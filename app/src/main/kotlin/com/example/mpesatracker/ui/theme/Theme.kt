package com.example.mpesatracker.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

val PrimaryGreen = Color(0xFF00A86B)
val PrimaryDark = Color(0xFF007A4E)
val PrimaryLight = Color(0xFFE8F8F2)

val BackgroundGray: Color
    @Composable
    get() = MaterialTheme.colorScheme.background

val SurfaceWhite: Color
    @Composable
    get() = MaterialTheme.colorScheme.surface

val TextDark: Color
    @Composable
    get() = MaterialTheme.colorScheme.onBackground

val TextGray: Color
    @Composable
    get() = if (isSystemInDarkTheme()) Color(0xFF9CA3AF) else Color(0xFF6B7280)

val TextMuted: Color
    @Composable
    get() = if (isSystemInDarkTheme()) Color(0xFF6B7280) else Color(0xFF9CA3AF)

val SuccessGreen = Color(0xFF10B981)
val ErrorRed = Color(0xFFEF4444)
val WarningOrange = Color(0xFFF59E0B)

val BorderLight: Color
    @Composable
    get() = MaterialTheme.colorScheme.outline

private val LightColorScheme = lightColorScheme(
    primary = PrimaryGreen,
    onPrimary = Color.White,
    primaryContainer = PrimaryLight,
    onPrimaryContainer = PrimaryDark,
    background = Color(0xFFF4F6F8),
    onBackground = Color(0xFF1A2332),
    surface = Color(0xFFFFFFFF),
    onSurface = Color(0xFF1A2332),
    outline = Color(0xFFE5E7EB),
    error = ErrorRed,
    onError = Color.White
)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF003D27),
    onPrimaryContainer = PrimaryLight,
    background = Color(0xFF121212),
    onBackground = Color(0xFFF4F6F8),
    surface = Color(0xFF1E1E1E),
    onSurface = Color(0xFFF4F6F8),
    outline = Color(0xFF2E2E2E),
    error = ErrorRed,
    onError = Color.White
)

@Composable
fun MpesaTrackerTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = Color.Transparent.toArgb()
            val windowInsetsController = WindowCompat.getInsetsController(window, view)
            windowInsetsController.isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
