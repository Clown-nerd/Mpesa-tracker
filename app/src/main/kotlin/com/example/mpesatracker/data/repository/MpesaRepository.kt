package com.example.mpesatracker.data.repository

import com.example.mpesatracker.data.local.*
import com.example.mpesatracker.data.model.*
import com.example.mpesatracker.util.CategoryLearning
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

class MpesaRepository(private val db: AppDatabase) {

    private val transactionDao = db.transactionDao()
    private val categoryPatternDao = db.categoryPatternDao()
    private val smsDao = db.smsDao()
    private val budgetDao = db.budgetDao()

    val allTransactionsFlow: Flow<List<MpesaTransaction>> = transactionDao.getAllTransactionsFlow()
    val allBudgetsFlow: Flow<List<Budget>> = budgetDao.getAllBudgetsFlow()

    suspend fun saveTransaction(transaction: MpesaTransaction): Boolean = withContext(Dispatchers.IO) {
        // Check duplicate by id
        if (transactionDao.getTransactionById(transaction.id) != null) {
            return@withContext false
        }

        // Check duplicate by confirmationCode if present
        transaction.confirmationCode?.let { code ->
            if (transactionDao.getTransactionByConfirmationCode(code) != null) {
                return@withContext false
            }
        }

        // Apply automatic category learning if not set yet
        val parsedWithLearning = CategoryLearning.applyLearnedCategory(transaction, categoryPatternDao)

        transactionDao.insertTransaction(parsedWithLearning)
        return@withContext true
    }

    suspend fun updateTransaction(transaction: MpesaTransaction) = withContext(Dispatchers.IO) {
        transactionDao.updateTransaction(transaction)
    }

    suspend fun deleteTransaction(id: String) = withContext(Dispatchers.IO) {
        transactionDao.deleteTransactionById(id)
    }

    suspend fun clearAllTransactions() = withContext(Dispatchers.IO) {
        transactionDao.clearAllTransactions()
    }

    suspend fun getAllBudgets(): List<Budget> = withContext(Dispatchers.IO) {
        budgetDao.getAllBudgets()
    }

    suspend fun saveBudget(budget: Budget) = withContext(Dispatchers.IO) {
        budgetDao.insertBudget(budget)
    }

    suspend fun saveBudgets(budgets: List<Budget>) = withContext(Dispatchers.IO) {
        budgetDao.insertBudgets(budgets)
    }

    suspend fun clearAllBudgets() = withContext(Dispatchers.IO) {
        budgetDao.clearAllBudgets()
    }

    suspend fun getProcessedSmsIds(): List<String> = withContext(Dispatchers.IO) {
        smsDao.getAllProcessedSmsIds()
    }

    suspend fun addProcessedSmsId(smsId: String) = withContext(Dispatchers.IO) {
        smsDao.insertProcessedSmsId(ProcessedSmsId(smsId))
        smsDao.pruneProcessedSmsIds()
    }

    suspend fun recordCategorization(party: String?, categoryOrSource: String?, kind: String) = withContext(Dispatchers.IO) {
        CategoryLearning.recordCategorization(party, categoryOrSource, kind, categoryPatternDao)
        
        val normalizedParty = CategoryLearning.normalizeParty(party)
        if (normalizedParty != null && categoryOrSource != null) {
            val allTxs = transactionDao.getAllTransactions()
            for (tx in allTxs) {
                val txNormParty = CategoryLearning.normalizeParty(tx.party)
                if (txNormParty != null && (txNormParty == normalizedParty || txNormParty.contains(normalizedParty) || normalizedParty.contains(txNormParty))) {
                    if (kind == "expense" && tx.isExpense && tx.category != categoryOrSource) {
                        transactionDao.insertTransaction(tx.copy(category = categoryOrSource, categorized = true))
                    } else if (kind == "income" && tx.isIncome && tx.incomeSource != categoryOrSource) {
                        transactionDao.insertTransaction(tx.copy(incomeSource = categoryOrSource))
                    }
                }
            }
        }
    }

    suspend fun clearAllPatterns() = withContext(Dispatchers.IO) {
        categoryPatternDao.clearAllPatterns()
    }

    suspend fun getRecentTransactions(limit: Int): List<MpesaTransaction> = withContext(Dispatchers.IO) {
        transactionDao.getRecentTransactions(limit)
    }
}
