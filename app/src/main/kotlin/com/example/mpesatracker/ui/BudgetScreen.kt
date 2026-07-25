package com.example.mpesatracker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.mpesatracker.ui.theme.*
import com.example.mpesatracker.util.AnalyticsUtils.filterByMonth
import com.example.mpesatracker.util.AnalyticsUtils.sumByCategory
import com.example.mpesatracker.util.Constants
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetScreen(viewModel: MpesaViewModel) {
    val transactions by viewModel.transactions.collectAsState()
    val budgets by viewModel.budgets.collectAsState()

    var editingCategory by remember { mutableStateOf<String?>(null) }
    var editValue by remember { mutableStateOf("") }

    val now = Calendar.getInstance()
    val currentMonth = now.get(Calendar.MONTH)
    val currentYear = now.get(Calendar.YEAR)
    val monthName = SimpleDateFormat("MMMM yyyy", Locale.US).format(now.time)

    // Slice monthly expenses
    val monthlyTxs = transactions.filterByMonth(currentMonth, currentYear)
    val spending = monthlyTxs.sumByCategory()

    // Aggregates
    val totalBudget = budgets.values.sum()
    val totalSpent = spending.values.sum()
    val totalRemaining = totalBudget - totalSpent
    val pctUsed = if (totalBudget > 0) (totalSpent / totalBudget).toFloat() else 0f

    // Over budget categories
    val overBudgetCats = Constants.CATEGORIES.values.filter { cat ->
        val b = budgets[cat.id] ?: 0.0
        val s = spending[cat.id] ?: 0.0
        b > 0 && s > b
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Budget",
                            fontWeight = FontWeight.ExtraBold,
                            fontSize = 22.sp,
                            color = TextDark
                        )
                        Text(
                            text = monthName,
                            fontSize = 13.sp,
                            color = TextGray
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
            // Overview card
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                Text(text = "Monthly Budget", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = "KES ${totalBudget.toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = TextDark)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                Text(text = "Spent", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(4.dp))
                                val spentColor = if (totalSpent > totalBudget) ErrorRed else TextDark
                                Text(text = "KES ${totalSpent.toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = spentColor)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.weight(1f)) {
                                Text(text = "Remaining", fontSize = 11.sp, color = TextMuted, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(4.dp))
                                val remainingColor = if (totalRemaining >= 0) SuccessGreen else ErrorRed
                                Text(text = "KES ${Math.max(totalRemaining, 0.0).toInt()}", fontSize = 14.sp, fontWeight = FontWeight.Black, color = remainingColor)
                            }
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        val progressColor = if (totalSpent > totalBudget) ErrorRed else PrimaryGreen
                        LinearProgressIndicator(
                            progress = { Math.min(pctUsed, 1f) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(8.dp)
                                .clip(CircleShape),
                            color = progressColor,
                            trackColor = BorderLight
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Text(
                            text = if (totalBudget > 0) "${(pctUsed * 100).toInt()}% used" else "No budget set",
                            fontSize = 11.sp,
                            color = TextGray,
                            fontWeight = FontWeight.Bold,
                            textAlign = TextAlign.End,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            // Spending vs Budget Chart
            item {
                BudgetVsSpendChart(spending = spending, budgets = budgets)
            }

            // Warning Card
            if (overBudgetCats.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = ErrorRed.copy(alpha = 0.08f)),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "⚠️ Over Budget",
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 15.sp,
                                color = ErrorRed
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "You have exceeded your spending limit in: " + overBudgetCats.joinToString { it.label },
                                fontSize = 13.sp,
                                color = ErrorRed,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
            }

            // Section Header
            item {
                Text(
                    text = "Category Budgets",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TextDark
                )
            }

            // Category list
            items(Constants.CATEGORIES.values.toList()) { cat ->
                val budget = budgets[cat.id] ?: 0.0
                val spent = spending[cat.id] ?: 0.0
                val isOver = budget > 0 && spent > budget
                val remaining = budget - spent
                val catPct = if (budget > 0) (spent / budget).toFloat() else 0f

                Card(
                    colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable {
                            editingCategory = cat.id
                            editValue = budget.toInt().toString()
                        }
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(40.dp)
                                    .background(
                                        Color(android.graphics.Color.parseColor(cat.color)).copy(alpha = 0.12f),
                                        RoundedCornerShape(10.dp)
                                    )
                            ) {
                                Text(text = cat.icon, fontSize = 20.sp)
                            }

                            Spacer(modifier = Modifier.width(12.dp))

                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = cat.label,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = TextDark
                                )

                                if (budget > 0) {
                                    val remColor = if (isOver) ErrorRed else TextGray
                                    val remText = if (isOver) {
                                        "Over by KES ${Math.abs(remaining).toInt()}"
                                    } else {
                                        "KES ${remaining.toInt()} left"
                                    }
                                    Text(
                                        text = remText,
                                        fontSize = 12.sp,
                                        color = remColor,
                                        fontWeight = FontWeight.Medium
                                    )
                                } else {
                                    Text(
                                        text = "Tap to set budget",
                                        fontSize = 12.sp,
                                        color = PrimaryGreen,
                                        fontWeight = FontWeight.Medium
                                    )
                                }
                            }

                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "KES ${spent.toInt()}",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp,
                                    color = TextDark
                                )
                                if (budget > 0) {
                                    Text(
                                        text = "of KES ${budget.toInt()}",
                                        fontSize = 11.sp,
                                        color = TextMuted,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }

                        if (budget > 0) {
                            Spacer(modifier = Modifier.height(12.dp))
                            val barColor = if (isOver) ErrorRed else Color(android.graphics.Color.parseColor(cat.color))
                            LinearProgressIndicator(
                                progress = { Math.min(catPct, 1f) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(6.dp)
                                    .clip(CircleShape),
                                color = barColor,
                                trackColor = BorderLight
                            )
                        }
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    // Edit Modal
    editingCategory?.let { catId ->
        val cat = Constants.CATEGORIES[catId] ?: Constants.CATEGORIES["OTHER"]!!
        Dialog(onDismissRequest = { editingCategory = null }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(20.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Text(
                        text = "${cat.icon} ${cat.label}",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        color = TextDark
                    )

                    Text(
                        text = "Set monthly budget (KES)",
                        fontSize = 13.sp,
                        color = TextGray,
                        fontWeight = FontWeight.Medium
                    )

                    OutlinedTextField(
                        value = editValue,
                        onValueChange = { editValue = it },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = PrimaryGreen)
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        TextButton(
                            onClick = { editingCategory = null },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text(text = "Cancel", color = TextGray)
                        }

                        Button(
                            onClick = {
                                val amt = editValue.toDoubleOrNull() ?: 0.0
                                viewModel.saveBudget(catId, amt)
                                editingCategory = null
                            },
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
}

@Composable
fun BudgetVsSpendChart(
    spending: Map<String, Double>,
    budgets: Map<String, Double>,
    modifier: Modifier = Modifier
) {
    val activeCategories = Constants.CATEGORIES.values.filter { cat ->
        (budgets[cat.id] ?: 0.0) > 0.0 || (spending[cat.id] ?: 0.0) > 0.0
    }

    if (activeCategories.isEmpty()) {
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
            shape = RoundedCornerShape(16.dp),
            modifier = modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "📊 Spending vs Budget",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    color = TextDark
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = "Set a budget below or record transactions to visualize your spending comparison chart.",
                    fontSize = 12.sp,
                    color = TextGray,
                    textAlign = TextAlign.Center
                )
            }
        }
        return
    }

    val maxVal = activeCategories.maxOfOrNull { cat ->
        maxOf(budgets[cat.id] ?: 0.0, spending[cat.id] ?: 0.0)
    }?.coerceAtLeast(100.0) ?: 100.0

    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = "Monthly Spend vs Budget",
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp,
                color = TextDark
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Legend
            Row(
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(PrimaryGreen.copy(alpha = 0.35f), CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Budget", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Bold)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(PrimaryGreen, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Spent (Within)", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Bold)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .background(ErrorRed, CircleShape)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(text = "Spent (Over)", fontSize = 11.sp, color = TextGray, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Horizontal Scrollable Chart Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            ) {
                // Background grid lines (draw 5 horizontal lines)
                Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    repeat(5) {
                        HorizontalDivider(
                            modifier = Modifier.fillMaxWidth(),
                            thickness = 0.5.dp,
                            color = BorderLight
                        )
                    }
                }

                // The bars list
                LazyRow(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(20.dp),
                    verticalAlignment = Alignment.Bottom
                ) {
                    items(activeCategories) { cat ->
                        val budget = budgets[cat.id] ?: 0.0
                        val spent = spending[cat.id] ?: 0.0
                        val isOver = budget > 0.0 && spent > budget

                        val budgetHeightFraction = (budget / maxVal).toFloat().coerceIn(0.01f, 1f)
                        val spentHeightFraction = (spent / maxVal).toFloat().coerceIn(0.01f, 1f)

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.width(56.dp)
                        ) {
                            // Value text labels (compact)
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly
                            ) {
                                Text(
                                    text = formatAmountShort(budget),
                                    fontSize = 9.sp,
                                    color = TextMuted,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1
                                )
                                Text(
                                    text = formatAmountShort(spent),
                                    fontSize = 9.sp,
                                    color = if (isOver) ErrorRed else SuccessGreen,
                                    fontWeight = FontWeight.Bold,
                                    maxLines = 1
                                )
                            }

                            Spacer(modifier = Modifier.height(4.dp))

                            // Dual Bar Display
                            Row(
                                modifier = Modifier
                                    .height(110.dp)
                                    .fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceEvenly,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                // Budget Bar (Left)
                                Box(
                                    modifier = Modifier
                                        .width(16.dp)
                                        .fillMaxHeight(budgetHeightFraction)
                                        .background(
                                            color = PrimaryGreen.copy(alpha = 0.35f),
                                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                                        )
                                )
                                // Spent Bar (Right)
                                Box(
                                    modifier = Modifier
                                        .width(16.dp)
                                        .fillMaxHeight(spentHeightFraction)
                                        .background(
                                            color = if (isOver) ErrorRed else Color(android.graphics.Color.parseColor(cat.color)),
                                            shape = RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp)
                                        )
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Icon and label
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(24.dp)
                                    .background(
                                        Color(android.graphics.Color.parseColor(cat.color)).copy(alpha = 0.12f),
                                        CircleShape
                                    )
                            ) {
                                Text(text = cat.icon, fontSize = 12.sp)
                            }
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = cat.label,
                                fontSize = 10.sp,
                                color = TextDark,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }
                    }
                }
            }
        }
    }
}

fun formatAmountShort(amount: Double): String {
    return when {
        amount >= 1_000_000 -> String.format(Locale.US, "%.1fM", amount / 1_000_000)
        amount >= 1_000 -> String.format(Locale.US, "%.1fk", amount / 1_000)
        else -> amount.toInt().toString()
    }
}
