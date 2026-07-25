package com.example.mpesatracker.data.local

import androidx.room.*
import com.example.mpesatracker.data.model.MpesaTransaction
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions ORDER BY date DESC, createdAt DESC")
    fun getAllTransactionsFlow(): Flow<List<MpesaTransaction>>

    @Query("SELECT * FROM transactions ORDER BY date DESC, createdAt DESC")
    suspend fun getAllTransactions(): List<MpesaTransaction>

    @Query("SELECT * FROM transactions ORDER BY date DESC, createdAt DESC LIMIT :limit")
    suspend fun getRecentTransactions(limit: Int): List<MpesaTransaction>

    @Query("SELECT * FROM transactions WHERE id = :id LIMIT 1")
    suspend fun getTransactionById(id: String): MpesaTransaction?

    @Query("SELECT * FROM transactions WHERE confirmationCode = :code LIMIT 1")
    suspend fun getTransactionByConfirmationCode(code: String): MpesaTransaction?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: MpesaTransaction)

    @Update
    suspend fun updateTransaction(transaction: MpesaTransaction)

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun deleteTransactionById(id: String)

    @Query("DELETE FROM transactions")
    suspend fun clearAllTransactions()
}
