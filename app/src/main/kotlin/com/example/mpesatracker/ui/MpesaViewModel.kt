package com.example.mpesatracker.ui

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.example.mpesatracker.data.local.AppDatabase
import com.example.mpesatracker.data.model.Budget
import com.example.mpesatracker.data.model.MpesaTransaction
import com.example.mpesatracker.data.repository.MpesaRepository
import com.example.mpesatracker.util.Constants
import com.example.mpesatracker.util.SettingsManager
import com.example.mpesatracker.util.SmsReader
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class MpesaViewModel(application: Application) : AndroidViewModel(application) {

    private val db = AppDatabase.getDatabase(application)
    private val repository = MpesaRepository(db)
    private val settingsManager = SettingsManager(application)

    val transactions: StateFlow<List<MpesaTransaction>> = repository.allTransactionsFlow
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyList()
        )

    val budgets: StateFlow<Map<String, Double>> = repository.allBudgetsFlow
        .map { list ->
            val map = list.associate { it.category to it.amount }.toMutableMap()
            // Default missing keys to 0.0 (no budget set)
            Constants.CATEGORIES.keys.forEach { catId ->
                if (!map.containsKey(catId)) {
                    map[catId] = 0.0
                }
            }
            map
        }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5000),
            initialValue = emptyMap()
        )

    private val _mpesaNumber = MutableStateFlow(settingsManager.mpesaNumber)
    val mpesaNumber: StateFlow<String> = _mpesaNumber.asStateFlow()

    private val _displayName = MutableStateFlow(settingsManager.displayName)
    val displayName: StateFlow<String> = _displayName.asStateFlow()

    private val _syncProgress = MutableStateFlow<SmsReader.SyncProgress?>(null)
    val syncProgress: StateFlow<SmsReader.SyncProgress?> = _syncProgress.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    private val _lastSyncNewCount = MutableStateFlow<Int?>(null)
    val lastSyncNewCount: StateFlow<Int?> = _lastSyncNewCount.asStateFlow()

    fun resetLastSyncNewCount() {
        _lastSyncNewCount.value = null
    }

    fun exportTransactionsToCsv(context: Context, onComplete: (String?) -> Unit) {
        viewModelScope.launch {
            try {
                val list = transactions.value
                if (list.isEmpty()) {
                    onComplete(null)
                    return@launch
                }

                val header = "ID,ConfirmationCode,Amount,Date,Type,Party,Category,IncomeSource,Note,Balance,PaybillNumber\n"
                val sb = StringBuilder(header)
                for (tx in list) {
                    val type = if (tx.isExpense) "expense" else "income"
                    val category = tx.category ?: ""
                    val source = tx.incomeSource ?: ""
                    val party = tx.party ?: ""
                    val note = tx.note ?: ""
                    val code = tx.confirmationCode ?: ""
                    val paybill = tx.paybillNumber ?: ""
                    val bal = tx.balance ?: ""

                    sb.append("${escapeCsv(tx.id)},")
                      .append("${escapeCsv(code)},")
                      .append("${tx.amount},")
                      .append("${tx.date},")
                      .append("${type},")
                      .append("${escapeCsv(party)},")
                      .append("${escapeCsv(category)},")
                      .append("${escapeCsv(source)},")
                      .append("${escapeCsv(note)},")
                      .append("${escapeCsv(bal.toString())},")
                      .append("${escapeCsv(paybill)}\n")
                }

                val csvData = sb.toString()
                val filename = "mpesa_transactions_${System.currentTimeMillis()}.csv"
                var savedUriStr: String? = null

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    val resolver = context.contentResolver
                    val contentValues = android.content.ContentValues().apply {
                        put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, filename)
                        put(android.provider.MediaStore.MediaColumns.MIME_TYPE, "text/csv")
                        put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS)
                    }
                    val uri = resolver.insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
                    if (uri != null) {
                        resolver.openOutputStream(uri)?.use { os ->
                            os.write(csvData.toByteArray())
                        }
                        savedUriStr = "Downloads/$filename"
                    }
                }

                if (savedUriStr == null) {
                    val downloadsDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS)
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs()
                    }
                    val file = java.io.File(downloadsDir, filename)
                    file.writeText(csvData)
                    savedUriStr = "Downloads/$filename"
                }

                onComplete(savedUriStr)
            } catch (e: Exception) {
                e.printStackTrace()
                // Fallback to app directory if public Downloads writing fails
                try {
                    val fallbackFile = java.io.File(context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS), "mpesa_backup.csv")
                    val header = "ID,ConfirmationCode,Amount,Date,Type,Party,Category,IncomeSource,Note,Balance,PaybillNumber\n"
                    val sb = StringBuilder(header)
                    for (tx in transactions.value) {
                        val type = if (tx.isExpense) "expense" else "income"
                        sb.append("${tx.id},${tx.confirmationCode ?: ""},${tx.amount},${tx.date},$type,${tx.party ?: ""},${tx.category ?: ""},${tx.incomeSource ?: ""},${tx.note ?: ""},${tx.balance ?: ""},${tx.paybillNumber ?: ""}\n")
                    }
                    fallbackFile.writeText(sb.toString())
                    onComplete(fallbackFile.absolutePath)
                } catch (ex: Exception) {
                    ex.printStackTrace()
                    onComplete(null)
                }
            }
        }
    }

    private fun escapeCsv(str: String): String {
        if (str.contains(",") || str.contains("\"") || str.contains("\n") || str.contains("\r")) {
            return "\"" + str.replace("\"", "\"\"") + "\""
        }
        return str
    }

    fun updateMpesaNumber(number: String) {
        settingsManager.mpesaNumber = number
        _mpesaNumber.value = number
    }

    fun updateDisplayName(name: String) {
        settingsManager.displayName = name
        _displayName.value = name
    }

    fun updateTransactionCategory(tx: MpesaTransaction, categoryId: String, note: String?) {
        viewModelScope.launch {
            repository.updateTransaction(
                tx.copy(category = categoryId, categorized = true, note = note)
            )
            repository.recordCategorization(tx.party, categoryId, "expense")
        }
    }

    fun updateTransactionIncomeSource(tx: MpesaTransaction, sourceId: String, note: String?) {
        viewModelScope.launch {
            repository.updateTransaction(
                tx.copy(incomeSource = sourceId, note = note)
            )
            repository.recordCategorization(tx.party, sourceId, "income")
        }
    }

    fun deleteTransaction(id: String) {
        viewModelScope.launch {
            repository.deleteTransaction(id)
        }
    }

    fun saveBudget(category: String, amount: Double) {
        viewModelScope.launch {
            repository.saveBudget(Budget(category, amount))
        }
    }

    fun clearAllData() {
        viewModelScope.launch {
            repository.clearAllTransactions()
            repository.clearAllPatterns()
            repository.clearAllBudgets()
        }
    }

    fun syncSms() {
        if (_isSyncing.value) return
        viewModelScope.launch {
            _isSyncing.value = true
            _lastSyncNewCount.value = null
            try {
                val newTxs = SmsReader.readExistingSms(
                    context = getApplication(),
                    repository = repository,
                    maxCount = 200,
                    onProgress = { progress ->
                        _syncProgress.value = progress
                    }
                )
                _lastSyncNewCount.value = newTxs.size
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                _syncProgress.value = null
                _isSyncing.value = false
            }
        }
    }
}
