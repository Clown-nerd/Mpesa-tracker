package com.example.mpesatracker.util

import com.example.mpesatracker.data.model.MpesaTransaction
import java.text.SimpleDateFormat
import java.util.*

object AnalyticsUtils {

    data class TransactionTotals(val expenses: Double, val income: Double)
    data class DaySpending(val day: String, val total: Double)
    data class MonthSpending(val label: String, val expenses: Double, val income: Double)

    fun List<MpesaTransaction>.filterByMonth(month: Int, year: Int): List<MpesaTransaction> {
        val cal = Calendar.getInstance()
        return this.filter {
            cal.timeInMillis = it.date
            cal.get(Calendar.MONTH) == month && cal.get(Calendar.YEAR) == year
        }
    }

    fun List<MpesaTransaction>.sumByCategory(): Map<String, Double> {
        return this.filter { it.isExpense && !it.category.isNullOrBlank() }
            .groupBy { it.category!! }
            .mapValues { entry -> entry.value.sumOf { it.amount } }
    }

    fun List<MpesaTransaction>.totals(): TransactionTotals {
        var expenses = 0.0
        var income = 0.0
        for (t in this) {
            if (t.isExpense) expenses += t.amount
            if (t.isIncome) income += t.amount
        }
        return TransactionTotals(expenses, income)
    }

    fun List<MpesaTransaction>.spendingByDay(days: Int = 7): List<DaySpending> {
        val result = mutableListOf<DaySpending>()
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val now = Calendar.getInstance()

        for (i in days - 1 downTo 0) {
            val d = Calendar.getInstance().apply {
                timeInMillis = now.timeInMillis
                add(Calendar.DAY_OF_YEAR, -i)
            }
            val dayStr = sdf.format(d.time)
            val dayTotal = this.filter {
                if (!it.isExpense) return@filter false
                val txDayStr = sdf.format(Date(it.date))
                txDayStr == dayStr
            }.sumOf { it.amount }
            result.add(DaySpending(dayStr, dayTotal))
        }
        return result
    }

    fun List<MpesaTransaction>.spendingByMonth(months: Int = 6): List<MonthSpending> {
        val result = mutableListOf<MonthSpending>()
        val now = Calendar.getInstance()
        val monthFormat = SimpleDateFormat("MMM", Locale.US)

        for (i in months - 1 downTo 0) {
            val d = Calendar.getInstance().apply {
                timeInMillis = now.timeInMillis
                set(Calendar.DAY_OF_MONTH, 1)
                add(Calendar.MONTH, -i)
            }
            val month = d.get(Calendar.MONTH)
            val year = d.get(Calendar.YEAR)
            val filtered = this.filterByMonth(month, year)
            val t = filtered.totals()
            result.add(MonthSpending(monthFormat.format(d.time), t.expenses, t.income))
        }
        return result
    }
}
