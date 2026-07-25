package com.example.mpesatracker.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.example.mpesatracker.data.model.Budget
import com.example.mpesatracker.data.model.CategoryPattern
import com.example.mpesatracker.data.model.MpesaTransaction
import com.example.mpesatracker.data.model.ProcessedSmsId

@Database(
    entities = [
        MpesaTransaction::class,
        CategoryPattern::class,
        ProcessedSmsId::class,
        Budget::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao
    abstract fun categoryPatternDao(): CategoryPatternDao
    abstract fun smsDao(): SmsDao
    abstract fun budgetDao(): BudgetDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "mpesa_tracker.db"
                )
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
