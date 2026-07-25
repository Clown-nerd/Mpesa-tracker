package com.example.mpesatracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.mpesatracker.data.model.MpesaTransaction
import com.example.mpesatracker.ui.theme.*
import com.example.mpesatracker.util.AnalyticsUtils.filterByMonth
import com.example.mpesatracker.util.AnalyticsUtils.spendingByDay
import com.example.mpesatracker.util.AnalyticsUtils.spendingByMonth
import com.example.mpesatracker.util.AnalyticsUtils.sumByCategory
import com.example.mpesatracker.util.AnalyticsUtils.totals
import com.example.mpesatracker.util.Constants
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InsightsScreen(viewModel: MpesaViewModel) {
    val transactions by viewModel.transactions.collectAsState()

    var targetCalendar by remember { mutableStateOf(Calendar.getInstance()) }

    val currentMonth = targetCalendar.get(Calendar.MONTH)
    val currentYear = targetCalendar.get(Calendar.YEAR)
    val monthLabel = SimpleDateFormat("MMMM yyyy", Locale.US).format(targetCalendar.time)

    // Slice monthly transactions
    val monthlyTxs = transactions.filterByMonth(currentMonth, currentYear)
    val (expenses, income) = monthlyTxs.totals()
    val netSavings = income - expenses
    val isPositive = netSavings >= 0

    // Top categories
    val categoryTotals = monthlyTxs.sumByCategory()
    val topCats = categoryTotals.entries
        .sortedByDescending { it.value }
        .take(4)

    // Income Sources
    val incomeTotals = mutableMapOf<String, Double>()
    monthlyTxs.filter { it.isIncome && !it.incomeSource.isNullOrBlank() }.forEach { t ->
        val source = t.incomeSource!!
        incomeTotals[source] = (incomeTotals[source] ?: 0.0) + t.amount
    }
    val topIncomes = incomeTotals.entries
        .sortedByDescending { it.value }

    // Last 12 months selector
    val monthsList = remember {
        val list = mutableListOf<Calendar>()
        val base = Calendar.getInstance()
        for (i in 0..11) {
            val cal = Calendar.getInstance()
            cal.add(Calendar.MONTH, -i)
            list.add(cal)
        }
        list
    }

    // Daily spending (last 7 days)
    val dailyData = transactions.spendingByDay(7)
    val dailyMax = dailyData.maxOfOrNull { it.total } ?: 0.0

    // 6-month trend data
    val monthlyTrend = transactions.spendingByMonth(6)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Insights",
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
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Month selector scroll
            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(monthsList) { m ->
                        val isActive = m.get(Calendar.MONTH) == currentMonth &&
                                m.get(Calendar.YEAR) == currentYear
                        val displayStr = SimpleDateFormat("MMM yy", Locale.US).format(m.time)

                        val bg = if (isActive) PrimaryGreen else SurfaceWhite
                        val tc = if (isActive) Color.White else TextGray

                        Card(
                            colors = CardDefaults.cardColors(containerColor = bg),
                            shape = RoundedCornerShape(20.dp),
                            modifier = Modifier
                                .clickable {
                                    targetCalendar = m
                                }
                        ) {
                            Box(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                                Text(
                                    text = displayStr,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = tc
                                )
                            }
                        }
                    }
                }
            }

            // Net savings line
            item {
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.Center
                ) {
                    val labelColor = if (isPositive) SuccessGreen else ErrorRed
                    val netStr = if (isPositive) "Saved this month:" else "Deficit:"
                    Text(
                        text = "$netStr KES ${Math.abs(netSavings).toInt()}",
                        color = labelColor,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp
                    )
                }
            }

            // Income vs Expenses summary row
            item {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    SummaryCardSmall(
                        title = "Income",
                        value = "KES ${income.toInt()}",
                        color = SuccessGreen,
                        modifier = Modifier.weight(1f)
                    )
                    SummaryCardSmall(
                        title = "Expenses",
                        value = "KES ${expenses.toInt()}",
                        color = ErrorRed,
                        modifier = Modifier.weight(1f)
                    )
                }
            }

            // Daily Spending (Bar Chart)
            if (dailyMax > 0) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Daily Spending (Last 7 Days)",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = TextDark,
                                modifier = Modifier.padding(bottom = 16.dp)
                            )
                            
                            // Bar chart layout
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(140.dp)
                                    .padding(horizontal = 8.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                dailyData.forEach { d ->
                                    val pct = if (dailyMax > 0) (d.total / dailyMax).toFloat() else 0f
                                    val dateObj = SimpleDateFormat("yyyy-MM-dd", Locale.US).parse(d.day)
                                    val dayName = if (dateObj != null) {
                                        SimpleDateFormat("EEE", Locale.US).format(dateObj)
                                    } else {
                                        ""
                                    }

                                    Column(
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        if (d.total > 0) {
                                            Text(
                                                text = if (d.total >= 1000) "${(d.total / 1000).toInt()}k" else "${d.total.toInt()}",
                                                fontSize = 9.sp,
                                                fontWeight = FontWeight.Bold,
                                                color = TextGray,
                                                modifier = Modifier.padding(bottom = 4.dp)
                                            )
                                        }
                                        Box(
                                            modifier = Modifier
                                                .fillMaxHeight(0.75f * pct + 0.05f)
                                                .width(14.dp)
                                                .clip(RoundedCornerShape(topStart = 4.dp, topEnd = 4.dp))
                                                .background(PrimaryGreen)
                                        )
                                        Spacer(modifier = Modifier.height(4.dp))
                                        Text(
                                            text = dayName,
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            color = TextMuted
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // 6-Month Trend (Line Chart)
            if (monthlyTrend.any { it.expenses > 0 || it.income > 0 }) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "6-Month Spending Trend",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = TextDark,
                                modifier = Modifier.padding(bottom = 12.dp)
                            )

                            // Custom Line Chart using Canvas
                            CustomTrendLineChart(monthlyTrend = monthlyTrend)

                            Spacer(modifier = Modifier.height(8.dp))

                            // Legends
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(modifier = Modifier.size(8.dp).background(SuccessGreen, CircleShape))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Income", fontSize = 11.sp, color = TextGray)

                                Spacer(modifier = Modifier.width(16.dp))

                                Box(modifier = Modifier.size(8.dp).background(ErrorRed, CircleShape))
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "Expenses", fontSize = 11.sp, color = TextGray)
                            }
                        }
                    }
                }
            }

            // Top categories breakdown
            if (topCats.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Top Categories — $monthLabel",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = TextDark,
                                modifier = Modifier.padding(bottom = 12.dp)
                            )

                            topCats.forEach { (catId, amount) ->
                                val cat = Constants.CATEGORIES[catId] ?: Constants.CATEGORIES["OTHER"]!!
                                val pct = if (expenses > 0) (amount / expenses) * 100 else 0.0

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(
                                                Color(android.graphics.Color.parseColor(cat.color)),
                                                CircleShape
                                            )
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "${cat.icon} ${cat.label}",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextDark,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = "${pct.toInt()}%",
                                        fontSize = 13.sp,
                                        color = TextGray,
                                        modifier = Modifier.padding(horizontal = 12.dp)
                                    )
                                    Text(
                                        text = "KES ${amount.toInt()}",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextDark,
                                        textAlign = TextAlign.End,
                                        modifier = Modifier.width(80.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Income sources breakdown
            if (topIncomes.isNotEmpty()) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(modifier = Modifier.padding(16.dp)) {
                            Text(
                                text = "Income Sources — $monthLabel",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp,
                                color = TextDark,
                                modifier = Modifier.padding(bottom = 12.dp)
                            )

                            topIncomes.forEach { (sourceId, amount) ->
                                val source = Constants.INCOME_SOURCES[sourceId] ?: Constants.INCOME_SOURCES["OTHER_INCOME"]!!
                                val pct = if (income > 0) (amount / income) * 100 else 0.0

                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 8.dp)
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(8.dp)
                                            .background(
                                                Color(android.graphics.Color.parseColor(source.color)),
                                                CircleShape
                                            )
                                    )
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text(
                                        text = "${source.icon} ${source.label}",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        color = TextDark,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = "${pct.toInt()}%",
                                        fontSize = 13.sp,
                                        color = TextGray,
                                        modifier = Modifier.padding(horizontal = 12.dp)
                                    )
                                    Text(
                                        text = "KES ${amount.toInt()}",
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TextDark,
                                        textAlign = TextAlign.End,
                                        modifier = Modifier.width(80.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // Empty State
            if (monthlyTxs.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(text = "📊", fontSize = 48.sp)
                        Text(
                            text = "No transactions for $monthLabel",
                            fontSize = 15.sp,
                            color = TextGray,
                            textAlign = TextAlign.Center
                        )
                    }
                }
            }

            item {
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }
}

@Composable
fun SummaryCardSmall(
    title: String,
    value: String,
    color: Color,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = SurfaceWhite),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp)
        ) {
            Text(
                text = title,
                fontSize = 12.sp,
                color = TextGray,
                fontWeight = FontWeight.Medium
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = value,
                fontSize = 16.sp,
                fontWeight = FontWeight.Black,
                color = color,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun CustomTrendLineChart(
    monthlyTrend: List<com.example.mpesatracker.util.AnalyticsUtils.MonthSpending>
) {
    val maxExpenses = monthlyTrend.maxOfOrNull { it.expenses } ?: 0.0
    val maxIncome = monthlyTrend.maxOfOrNull { it.income } ?: 0.0
    val maxVal = maxOf(maxExpenses, maxIncome, 100.0)

    val gridColor = BorderLight

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .padding(top = 16.dp, bottom = 24.dp, start = 8.dp, end = 8.dp)
    ) {
        val width = size.width
        val height = size.height

        val stepX = width / (monthlyTrend.size - 1).coerceAtLeast(1)

        // Grids
        val gridLines = 4
        for (i in 0..gridLines) {
            val y = height * i / gridLines
            drawLine(
                color = gridColor,
                start = Offset(0f, y),
                end = Offset(width, y),
                strokeWidth = 1f
            )
        }

        // Draw Income path (Green)
        val incomePath = Path()
        monthlyTrend.forEachIndexed { idx, point ->
            val x = idx * stepX
            val y = height - (point.income / maxVal * height).toFloat()
            if (idx == 0) {
                incomePath.moveTo(x, y)
            } else {
                incomePath.lineTo(x, y)
            }
        }
        drawPath(
            path = incomePath,
            color = SuccessGreen,
            style = Stroke(width = 6f)
        )

        // Draw Expenses path (Red)
        val expensesPath = Path()
        monthlyTrend.forEachIndexed { idx, point ->
            val x = idx * stepX
            val y = height - (point.expenses / maxVal * height).toFloat()
            if (idx == 0) {
                expensesPath.moveTo(x, y)
            } else {
                expensesPath.lineTo(x, y)
            }
        }
        drawPath(
            path = expensesPath,
            color = ErrorRed,
            style = Stroke(width = 6f)
        )

        // Draw dots & Labels
        monthlyTrend.forEachIndexed { idx, point ->
            val x = idx * stepX

            // Dots
            val yInc = height - (point.income / maxVal * height).toFloat()
            drawCircle(color = SuccessGreen, radius = 8f, center = Offset(x, yInc))

            val yExp = height - (point.expenses / maxVal * height).toFloat()
            drawCircle(color = ErrorRed, radius = 8f, center = Offset(x, yExp))
        }
    }

    // Draw Labels Row
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        monthlyTrend.forEach { m ->
            Text(
                text = m.label,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = TextMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f)
            )
        }
    }
}
