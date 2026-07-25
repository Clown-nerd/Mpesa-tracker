package com.example.mpesatracker.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.core.content.ContextCompat
import com.example.mpesatracker.data.model.MpesaTransaction
import com.example.mpesatracker.ui.theme.*
import com.example.mpesatracker.util.AnalyticsUtils.filterByMonth
import com.example.mpesatracker.util.AnalyticsUtils.sumByCategory
import com.example.mpesatracker.util.AnalyticsUtils.totals
import com.example.mpesatracker.util.Constants
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(viewModel: MpesaViewModel) {
    val context = LocalContext.current
    val transactions by viewModel.transactions.collectAsState()
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncProgress by viewModel.syncProgress.collectAsState()

    val uncategorizedCount = transactions.count {
        (it.isExpense && it.category.isNullOrBlank()) || (it.isIncome && it.incomeSource.isNullOrBlank())
    }

    var selectedDetailTx by remember { mutableStateOf<MpesaTransaction?>(null) }
    var selectedCategorizeTx by remember { mutableStateOf<MpesaTransaction?>(null) }
    var showNoteTx by remember { mutableStateOf<MpesaTransaction?>(null) }

    val lastSyncNewCount by viewModel.lastSyncNewCount.collectAsState()
    var showSyncCategorizePrompt by remember { mutableStateOf(false) }
    var isCategorizingQueue by remember { mutableStateOf(false) }

    LaunchedEffect(lastSyncNewCount) {
        lastSyncNewCount?.let { count ->
            if (count > 0 && uncategorizedCount > 0) {
                showSyncCategorizePrompt = true
            } else {
                viewModel.resetLastSyncNewCount()
            }
        }
    }

    LaunchedEffect(isCategorizingQueue, transactions, selectedCategorizeTx) {
        if (isCategorizingQueue && selectedCategorizeTx == null) {
            val uncategorized = transactions.filter {
                (it.isExpense && it.category.isNullOrBlank()) || (it.isIncome && it.incomeSource.isNullOrBlank())
            }
            if (uncategorized.isNotEmpty()) {
                selectedCategorizeTx = uncategorized.first()
            } else {
                isCategorizingQueue = false
            }
        }
    }

    val now = Calendar.getInstance()
    val currentMonth = now.get(Calendar.MONTH)
    val currentYear = now.get(Calendar.YEAR)
    val monthLabel = SimpleDateFormat("MMMM yyyy", Locale.US).format(now.time)
    val formattedDate = SimpleDateFormat("EEEE, d MMMM yyyy", Locale.US).format(now.time)

    val monthlyTxs = transactions.filterByMonth(currentMonth, currentYear)
    val (expenses, income) = monthlyTxs.totals()
    val categoryTotals = monthlyTxs.sumByCategory()

    // Top categories
    val topCategories = categoryTotals.entries
        .sortedByDescending { it.value }
        .take(5)

    // Recent transactions (last 10)
    val recentTransactions = transactions.take(10)

    // Permission check
    var hasSmsPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        )
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        hasSmsPermission = permissions[Manifest.permission.READ_SMS] == true &&
                permissions[Manifest.permission.RECEIVE_SMS] == true
        if (hasSmsPermission) {
            viewModel.syncSms()
        }
    }

    // Auto-sync once permissions are verified
    LaunchedEffect(hasSmsPermission) {
        if (hasSmsPermission) {
            viewModel.syncSms()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "M-Pesa Tracker",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 22.sp,
                            color = TextDark
                        )
                        Text(
                            text = formattedDate,
                            fontSize = 13.sp,
                            color = TextGray
                        )
                    }
                },
                actions = {
                    IconButton(
                        onClick = { viewModel.syncSms() },
                        enabled = !isSyncing,
                        modifier = Modifier.testTag("refresh_button")
                    ) {
                        Icon(
                            imageVector = Icons.Default.Refresh,
                            contentDescription = "Sync SMS",
                            tint = PrimaryGreen
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundGray)
            )
        },
        containerColor = BackgroundGray
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Permission Banner
            if (!hasSmsPermission) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFFFEF3C7)), // warm amber
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                launcher.launch(
                                    arrayOf(
                                        Manifest.permission.READ_SMS,
                                        Manifest.permission.RECEIVE_SMS
                                    )
                                )
                            }
                            .testTag("permission_banner")
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "📩 Tap to grant SMS access for auto-import",
                                color = TextDark,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            // Syncing Indicator
            if (isSyncing) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            LinearProgressIndicator(
                                modifier = Modifier.fillMaxWidth(),
                                color = PrimaryGreen,
                                trackColor = BorderLight
                            )
                            val prog = syncProgress
                            val progressText = if (prog != null) {
                                "Syncing... ${prog.processed}/${prog.total} (${prog.newFound} new)"
                            } else {
                                "Syncing SMS inbox..."
                            }
                            Text(
                                text = progressText,
                                fontSize = 12.sp,
                                color = TextGray,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }

            // Summary Card
            item {
                SummaryCard(income = income, expenses = expenses, period = monthLabel)
            }

            // Quick Categorization Card
            if (uncategorizedCount > 0 && !isSyncing) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { isCategorizingQueue = true }
                            .testTag("categorization_banner")
                    ) {
                        Row(
                            modifier = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "📊 Categorise Your Transactions",
                                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "You have $uncategorizedCount uncategorised transactions. Tap here to categorise them step-by-step.",
                                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f),
                                    fontSize = 12.sp
                                )
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(
                                onClick = { isCategorizingQueue = true },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.primary,
                                    contentColor = Color.White
                                ),
                                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                                modifier = Modifier.height(36.dp)
                            ) {
                                Text("Start", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }

            // Spending Categories
            if (topCategories.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Spending Categories",
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = TextDark,
                                modifier = Modifier.padding(bottom = 12.dp)
                            )

                            topCategories.forEach { (catId, total) ->
                                val cat = Constants.CATEGORIES[catId]
                                if (cat != null) {
                                    val pct = if (expenses > 0) (total / expenses).toFloat() else 0f
                                    Column(modifier = Modifier.padding(vertical = 6.dp)) {
                                        Row(
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            Text(
                                                text = "${cat.icon} ${cat.label}",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = TextDark
                                            )
                                            Text(
                                                text = "KES ${total.toInt()}",
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextGray
                                            )
                                        }
                                        Spacer(modifier = Modifier.height(4.dp))
                                        LinearProgressIndicator(
                                            progress = { pct },
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .height(6.dp)
                                                .clip(CircleShape),
                                            color = Color(android.graphics.Color.parseColor(cat.color)),
                                            trackColor = BorderLight
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Statistics Row
            item {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    StatCard(
                        value = "${monthlyTxs.count { it.isExpense }}",
                        label = "Transactions",
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        value = "${monthlyTxs.count { it.isIncome }}",
                        label = "Received",
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        value = "$uncategorizedCount",
                        label = "Uncategorised",
                        modifier = Modifier.weight(1f),
                        valueColor = if (uncategorizedCount > 0) ErrorRed else TextDark
                    )
                }
            }

            // Recent Transactions header
            item {
                Text(
                    text = "Recent Transactions",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TextDark
                )
            }

            // Recent Transactions List
            if (recentTransactions.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(text = "📭", fontSize = 48.sp)
                        Text(
                            text = "No transactions yet",
                            fontWeight = FontWeight.Bold,
                            fontSize = 16.sp,
                            color = TextDark
                        )
                        Text(
                            text = "Pull to sync your M-Pesa SMS messages.",
                            fontSize = 13.sp,
                            color = TextGray,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(horizontal = 24.dp)
                        )
                    }
                }
            } else {
                items(recentTransactions) { tx ->
                    TransactionItem(
                        transaction = tx,
                        onClick = { selectedDetailTx = tx },
                        onCategorizeClick = { selectedCategorizeTx = tx }
                    )
                }
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    // Detail Dialog
    selectedDetailTx?.let { tx ->
        TransactionDetailDialog(
            transaction = tx,
            onDismiss = { selectedDetailTx = null },
            onCategorize = {
                selectedCategorizeTx = tx
                selectedDetailTx = null
            },
            onDelete = {
                viewModel.deleteTransaction(tx.id)
                selectedDetailTx = null
            },
            onAddNote = {
                showNoteTx = tx
                selectedDetailTx = null
            }
        )
    }

    // Note Edit Dialog
    showNoteTx?.let { tx ->
        NoteEditDialog(
            initialNote = tx.note ?: "",
            onDismiss = { showNoteTx = null },
            onSave = { noteText ->
                if (tx.isIncome) {
                    viewModel.updateTransactionIncomeSource(tx, tx.incomeSource ?: "OTHER_INCOME", noteText)
                } else {
                    viewModel.updateTransactionCategory(tx, tx.category ?: "OTHER", noteText)
                }
                showNoteTx = null
            }
        )
    }

    // Categorization Dialog
    selectedCategorizeTx?.let { tx ->
        if (tx.isIncome) {
            IncomeSourceSelectionDialog(
                transaction = tx,
                onDismiss = {
                    selectedCategorizeTx = null
                    isCategorizingQueue = false
                },
                onSelect = { sourceId, note ->
                    viewModel.updateTransactionIncomeSource(tx, sourceId, note)
                    selectedCategorizeTx = null
                }
            )
        } else {
            CategorySelectionDialog(
                transaction = tx,
                onDismiss = {
                    selectedCategorizeTx = null
                    isCategorizingQueue = false
                },
                onSelect = { categoryId, note ->
                    viewModel.updateTransactionCategory(tx, categoryId, note)
                    selectedCategorizeTx = null
                }
            )
        }
    }

    // Sync Categorization Prompt Dialog
    if (showSyncCategorizePrompt) {
        Dialog(onDismissRequest = {
            showSyncCategorizePrompt = false
            viewModel.resetLastSyncNewCount()
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
                    Text(
                        text = "Categorise New Transactions? 📥",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = TextDark
                    )
                    Text(
                        text = "We imported $lastSyncNewCount new transactions from your SMS messages. There are currently $uncategorizedCount uncategorised transactions. Would you like to categorise them now to update your budget charts?",
                        fontSize = 13.sp,
                        color = TextGray,
                        lineHeight = 18.sp
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)
                    ) {
                        TextButton(onClick = {
                            showSyncCategorizePrompt = false
                            viewModel.resetLastSyncNewCount()
                        }) {
                            Text(text = "Later", color = TextGray)
                        }
                        Button(
                            onClick = {
                                showSyncCategorizePrompt = false
                                viewModel.resetLastSyncNewCount()
                                isCategorizingQueue = true
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen)
                        ) {
                            Text(text = "Categorise Now", color = Color.White)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SummaryCard(income: Double, expenses: Double, period: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = PrimaryGreen),
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = period.uppercase(Locale.US),
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.7f),
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Net Balance",
                fontSize = 14.sp,
                color = Color.White.copy(alpha = 0.8f)
            )
            Text(
                text = "KES ${(income - expenses).toInt()}",
                fontSize = 28.sp,
                fontWeight = FontWeight.Black,
                color = Color.White
            )

            Spacer(modifier = Modifier.height(16.dp))

            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(SuccessGreen, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Income",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                    Text(
                        text = "KES ${income.toInt()}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }

                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .background(Color.White, CircleShape)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Expenses",
                            fontSize = 12.sp,
                            color = Color.White.copy(alpha = 0.8f)
                        )
                    }
                    Text(
                        text = "KES ${expenses.toInt()}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
fun StatCard(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    valueColor: Color = TextDark
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = value,
                fontWeight = FontWeight.Black,
                fontSize = 22.sp,
                color = valueColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = label,
                fontSize = 11.sp,
                color = TextMuted,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun TransactionItem(
    transaction: MpesaTransaction,
    onClick: () -> Unit,
    onCategorizeClick: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon / Emoji
            val isUncategorized = (transaction.isExpense && transaction.category.isNullOrBlank()) ||
                    (transaction.isIncome && transaction.incomeSource.isNullOrBlank())

            val iconColor = if (transaction.isIncome) SuccessGreen else ErrorRed
            val iconText = if (transaction.isIncome) {
                Constants.INCOME_SOURCES[transaction.incomeSource]?.icon ?: "📥"
            } else {
                Constants.CATEGORIES[transaction.category]?.icon ?: "💸"
            }

            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(44.dp)
                    .background(iconColor.copy(alpha = 0.12f), RoundedCornerShape(10.dp))
            ) {
                Text(text = iconText, fontSize = 20.sp)
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = transaction.party ?: if (transaction.isIncome) "Received money" else "Sent money",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = TextDark,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val dateLabel = SimpleDateFormat("d MMM, hh:mm a", Locale.US).format(Date(transaction.date))
                    Text(
                        text = dateLabel,
                        fontSize = 11.sp,
                        color = TextMuted
                    )
                    transaction.note?.let { note ->
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(modifier = Modifier.size(3.dp).background(TextMuted, CircleShape))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = note,
                            fontSize = 11.sp,
                            color = PrimaryDark,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Amount / Action
            Column(horizontalAlignment = Alignment.End) {
                val prefix = if (transaction.isIncome) "+" else "-"
                val textColor = if (transaction.isIncome) SuccessGreen else TextDark
                Text(
                    text = "${prefix}KES ${transaction.amount.toInt()}",
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 15.sp,
                    color = textColor
                )

                if (isUncategorized) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .background(WarningOrange.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                            .clickable(onClick = onCategorizeClick)
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = "Categorise",
                            fontSize = 10.sp,
                            color = WarningOrange,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    Spacer(modifier = Modifier.height(4.dp))
                    val categoryLabel = if (transaction.isIncome) {
                        Constants.INCOME_SOURCES[transaction.incomeSource]?.label ?: "Income"
                    } else {
                        Constants.CATEGORIES[transaction.category]?.label ?: "Expense"
                    }
                    Text(
                        text = categoryLabel,
                        fontSize = 10.sp,
                        color = TextMuted,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
fun TransactionDetailDialog(
    transaction: MpesaTransaction,
    onDismiss: () -> Unit,
    onCategorize: () -> Unit,
    onDelete: () -> Unit,
    onAddNote: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header (Type & Amount)
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    Text(
                        text = if (transaction.isIncome) "INCOME RECEIVED" else "EXPENSE PAID",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (transaction.isIncome) SuccessGreen else ErrorRed,
                        letterSpacing = 1.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "KES ${transaction.amount}",
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Black,
                        color = TextDark
                    )
                }

                Divider(color = BorderLight)

                // Details Grid
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    DetailRow(label = "Sender/Recipient", value = transaction.party ?: "Unknown")
                    transaction.confirmationCode?.let { DetailRow(label = "Confirmation Code", value = it) }
                    val fullDate = SimpleDateFormat("EEEE, d MMMM yyyy, hh:mm a", Locale.US).format(Date(transaction.date))
                    DetailRow(label = "Date", value = fullDate)
                    transaction.accountNumber?.let { DetailRow(label = "Account", value = it) }
                    transaction.paybillNumber?.let { DetailRow(label = "Paybill/Business No", value = it) }
                    transaction.balance?.let { DetailRow(label = "M-Pesa Balance", value = "KES $it") }

                    val categoryLabel = if (transaction.isIncome) {
                        Constants.INCOME_SOURCES[transaction.incomeSource]?.label ?: "Unclassified"
                    } else {
                        Constants.CATEGORIES[transaction.category]?.label ?: "Unclassified"
                    }
                    DetailRow(label = "Category", value = categoryLabel)

                    transaction.note?.let { DetailRow(label = "Note", value = it) }
                }

                // Raw SMS Expansion (Simple expander)
                transaction.rawMessage?.let { raw ->
                    var isExpanded by remember { mutableStateOf(false) }
                    Column {
                        Text(
                            text = if (isExpanded) "Hide Raw SMS" else "Show Raw SMS",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = PrimaryDark,
                            modifier = Modifier
                                .clickable { isExpanded = !isExpanded }
                                .padding(vertical = 4.dp)
                        )
                        if (isExpanded) {
                            Text(
                                text = raw,
                                fontSize = 11.sp,
                                color = TextGray,
                                modifier = Modifier
                                    .background(BackgroundGray, RoundedCornerShape(8.dp))
                                    .padding(8.dp)
                                    .fillMaxWidth()
                            )
                        }
                    }
                }

                Divider(color = BorderLight)

                // Actions Layout
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    IconButton(
                        onClick = onAddNote,
                        modifier = Modifier
                            .background(BorderLight, RoundedCornerShape(8.dp))
                            .size(44.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Edit, contentDescription = "Edit Note", tint = TextDark)
                    }

                    IconButton(
                        onClick = onDelete,
                        modifier = Modifier
                            .background(ErrorRed.copy(alpha = 0.12f), RoundedCornerShape(8.dp))
                            .size(44.dp)
                    ) {
                        Icon(imageVector = Icons.Default.Delete, contentDescription = "Delete", tint = ErrorRed)
                    }

                    Button(
                        onClick = onCategorize,
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp)
                    ) {
                        Text(text = "Categorise", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Text(text = label, fontSize = 12.sp, color = TextMuted, modifier = Modifier.weight(1f))
        Text(
            text = value,
            fontSize = 12.sp,
            color = TextDark,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1.5f)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteEditDialog(
    initialNote: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var noteText by remember { mutableStateOf(initialNote) }
    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth().padding(16.dp)
        ) {
            Column(
                modifier = Modifier.padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Text(text = "Add/Edit Note", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = TextDark)
                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    placeholder = { Text(text = "Add notes or transaction details...") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGreen)
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TextButton(onClick = onDismiss, modifier = Modifier.weight(1f)) {
                        Text(text = "Cancel", color = TextGray)
                    }
                    Button(
                        onClick = { onSave(noteText) },
                        colors = ButtonDefaults.buttonColors(containerColor = PrimaryGreen),
                        modifier = Modifier.weight(1f)
                    ) {
                        Text(text = "Save")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CategorySelectionDialog(
    transaction: MpesaTransaction,
    onDismiss: () -> Unit,
    onSelect: (String, String) -> Unit
) {
    var noteText by remember { mutableStateOf(transaction.note ?: "") }
    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Select Category",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextDark
                )

                Text(
                    text = "Transaction with: ${transaction.party ?: "Unknown"}",
                    fontSize = 12.sp,
                    color = TextGray
                )

                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    label = { Text("Note (Optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGreen)
                )

                Spacer(modifier = Modifier.height(4.dp))

                // Scrollable Grid of Categories
                Box(modifier = Modifier.height(280.dp)) {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val list = Constants.CATEGORIES.values.toList()
                        // Chunk list into pairs of 2 columns
                        val chunks = list.chunked(2)
                        items(chunks) { rowItems ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                rowItems.forEach { cat ->
                                    Card(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable { onSelect(cat.id, noteText) },
                                        colors = CardDefaults.cardColors(
                                            containerColor = Color(android.graphics.Color.parseColor(cat.color)).copy(alpha = 0.08f)
                                        ),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(text = cat.icon, fontSize = 20.sp)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = cat.label,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextDark,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }
                                if (rowItems.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(text = "Cancel", color = TextGray)
                    }
                }
            }
        }
    }
}

@Composable
fun IncomeSourceSelectionDialog(
    transaction: MpesaTransaction,
    onDismiss: () -> Unit,
    onSelect: (String, String) -> Unit
) {
    var noteText by remember { mutableStateOf(transaction.note ?: "") }
    Dialog(onDismissRequest = onDismiss) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Select Income Source",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextDark
                )

                Text(
                    text = "Deposit from: ${transaction.party ?: "Unknown"}",
                    fontSize = 12.sp,
                    color = TextGray
                )

                OutlinedTextField(
                    value = noteText,
                    onValueChange = { noteText = it },
                    label = { Text("Note (Optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGreen)
                )

                Spacer(modifier = Modifier.height(4.dp))

                Box(modifier = Modifier.height(280.dp)) {
                    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val list = Constants.INCOME_SOURCES.values.toList()
                        val chunks = list.chunked(2)
                        items(chunks) { rowItems ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                rowItems.forEach { source ->
                                    Card(
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable { onSelect(source.id, noteText) },
                                        colors = CardDefaults.cardColors(
                                            containerColor = Color(android.graphics.Color.parseColor(source.color)).copy(alpha = 0.08f)
                                        ),
                                        shape = RoundedCornerShape(10.dp)
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Text(text = source.icon, fontSize = 20.sp)
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Text(
                                                text = source.label,
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextDark,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }
                                if (rowItems.size == 1) {
                                    Spacer(modifier = Modifier.weight(1f))
                                }
                            }
                        }
                    }
                }

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = onDismiss) {
                        Text(text = "Cancel", color = TextGray)
                    }
                }
            }
        }
    }
}
