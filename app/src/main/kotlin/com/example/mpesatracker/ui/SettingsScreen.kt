package com.example.mpesatracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.mpesatracker.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: MpesaViewModel) {
    val mpesaNumber by viewModel.mpesaNumber.collectAsState()
    val displayName by viewModel.displayName.collectAsState()

    var showExportAlert by remember { mutableStateOf(false) }
    var showClearConfirm by remember { mutableStateOf(false) }

    val context = androidx.compose.ui.platform.LocalContext.current
    var isExporting by remember { mutableStateOf(false) }
    var exportResultPath by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Settings",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 22.sp,
                        color = TextDark
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundGray)
            )
        },
        containerColor = BackgroundGray
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header Description
            Text(
                text = "Configure account profile and local storage",
                fontSize = 13.sp,
                color = TextGray,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // ACCOUNT SECTION
            SettingsSection(title = "ACCOUNT") {
                Column {
                    SettingsInputRow(
                        label = "M-Pesa Number",
                        value = mpesaNumber,
                        onValueChange = { viewModel.updateMpesaNumber(it) },
                        placeholder = "e.g. 0712 345 678",
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                    )
                    Divider(color = BorderLight, modifier = Modifier.padding(horizontal = 16.dp))
                    SettingsInputRow(
                        label = "Display Name",
                        value = displayName,
                        onValueChange = { viewModel.updateDisplayName(it) },
                        placeholder = "e.g. Jane Doe"
                    )
                }
            }

            // DATA SECTION
            SettingsSection(title = "DATA") {
                Column {
                    SettingsClickableRow(
                        label = "Export Transactions",
                        onClick = { showExportAlert = true }
                    )
                    Divider(color = BorderLight, modifier = Modifier.padding(horizontal = 16.dp))
                    SettingsClickableRow(
                        label = "Clear All Data",
                        labelColor = ErrorRed,
                        onClick = { showClearConfirm = true }
                    )
                }
            }

            // ABOUT SECTION
            SettingsSection(title = "ABOUT") {
                Column {
                    SettingsStaticRow(
                        label = "Version",
                        value = "1.0.0"
                    )
                    Divider(color = BorderLight, modifier = Modifier.padding(horizontal = 16.dp))
                    SettingsStaticRow(
                        label = "Built for Kenya 🇰🇪",
                        value = "Active"
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }

    // Export Alert
    if (showExportAlert) {
        Dialog(onDismissRequest = {
            if (!isExporting) {
                showExportAlert = false
                exportResultPath = null
            }
        }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Backup & Export Data", fontSize = 18.sp, fontWeight = FontWeight.Black, color = TextDark)

                    if (isExporting) {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            CircularProgressIndicator(color = PrimaryGreen)
                            Text(
                                text = "Compiling transaction history to CSV format...",
                                fontSize = 13.sp,
                                color = TextGray,
                                textAlign = TextAlign.Center
                            )
                        }
                    } else if (exportResultPath != null) {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            val isError = exportResultPath?.contains("failed", ignoreCase = true) == true
                            Text(
                                text = if (isError) "Export Failed ❌" else "Export Successful! 🎉",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isError) ErrorRed else SuccessGreen
                            )
                            Text(
                                text = if (isError) "An error occurred while compiling your backup." else "Your data backup has been generated. The file is saved at:",
                                fontSize = 13.sp,
                                color = TextGray
                            )
                            if (!isError) {
                                Text(
                                    text = exportResultPath ?: "",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextDark,
                                    modifier = Modifier
                                        .background(BackgroundGray, RoundedCornerShape(6.dp))
                                        .padding(8.dp)
                                        .fillMaxWidth()
                                )
                                Text(
                                    text = "You can access this file using any standard file explorer under your device's Downloads directory.",
                                    fontSize = 11.sp,
                                    color = TextMuted
                                )
                            }
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.End
                        ) {
                            TextButton(onClick = {
                                showExportAlert = false
                                exportResultPath = null
                            }) {
                                Text(text = "Got it", color = PrimaryGreen, fontWeight = FontWeight.Bold)
                            }
                        }
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                text = "Would you like to export your transaction history as a CSV spreadsheet? This can be used to import into spreadsheet tools or back up your data locally.",
                                fontSize = 13.sp,
                                color = TextGray,
                                lineHeight = 18.sp
                            )
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)
                        ) {
                            TextButton(onClick = { showExportAlert = false }) {
                                Text(text = "Cancel", color = TextGray)
                            }
                            Button(
                                onClick = {
                                    isExporting = true
                                    viewModel.exportTransactionsToCsv(context) { path ->
                                        isExporting = false
                                        exportResultPath = path ?: "Failed to save CSV file."
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)
                            ) {
                                Text(text = "Export CSV", color = Color.White)
                            }
                        }
                    }
                }
            }
        }
    }

    // Clear Confirm
    if (showClearConfirm) {
        Dialog(onDismissRequest = { showClearConfirm = false }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(text = "Clear All Data", fontSize = 18.sp, fontWeight = FontWeight.Black, color = ErrorRed)
                    Text(
                        text = "Are you absolutely sure you want to delete all transactions and reset your learned categories? This action is permanent and cannot be undone.",
                        fontSize = 13.sp,
                        color = TextGray,
                        lineHeight = 18.sp
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(
                            onClick = { showClearConfirm = false },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(text = "Cancel", color = TextGray)
                        }
                        Button(
                            onClick = {
                                viewModel.clearAllData()
                                showClearConfirm = false
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = ErrorRed),
                            modifier = Modifier.weight(1.2f)
                        ) {
                            Text(text = "Clear Everything")
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Column {
        Text(
            text = title,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = TextGray,
            modifier = Modifier.padding(start = 4.dp, bottom = 6.dp)
        )
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            content()
        }
    }
}

@Composable
fun SettingsInputRow(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextDark
        )
        TextField(
            value = value,
            onValueChange = onValueChange,
            placeholder = { Text(text = placeholder, color = TextMuted) },
            singleLine = true,
            keyboardOptions = keyboardOptions,
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                disabledContainerColor = Color.Transparent,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent
            ),
            textStyle = LocalTextStyle.current.copy(
                textAlign = TextAlign.End,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                color = TextDark
            ),
            modifier = Modifier
                .width(180.dp)
                .fillMaxHeight()
        )
    }
}

@Composable
fun SettingsClickableRow(
    label: String,
    labelColor: Color = TextDark,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = labelColor
        )
        Text(
            text = "›",
            fontSize = 22.sp,
            color = TextMuted,
            fontWeight = FontWeight.Light
        )
    }
}

@Composable
fun SettingsStaticRow(
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(52.dp)
            .padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = TextDark
        )
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = TextGray
        )
    }
}
