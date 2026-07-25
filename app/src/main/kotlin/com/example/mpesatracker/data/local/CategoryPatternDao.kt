package com.example.mpesatracker.data.local

import androidx.room.*
import com.example.mpesatracker.data.model.CategoryPattern

@Dao
interface CategoryPatternDao {
    @Query("SELECT * FROM category_patterns WHERE kind = :kind AND party = :party AND category = :category LIMIT 1")
    suspend fun getPattern(kind: String, party: String, category: String): CategoryPattern?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPattern(pattern: CategoryPattern)

    @Query("SELECT * FROM category_patterns WHERE kind = :kind AND party = :party ORDER BY count DESC")
    suspend fun getPatternsForParty(kind: String, party: String): List<CategoryPattern>

    @Query("SELECT * FROM category_patterns WHERE kind = :kind ORDER BY count DESC")
    suspend fun getAllPatterns(kind: String): List<CategoryPattern>

    @Query("SELECT category, SUM(count) as total FROM category_patterns WHERE kind = :kind GROUP BY category ORDER BY total DESC LIMIT :limit")
    suspend fun getTopCategories(kind: String, limit: Int): List<CategoryTotal>

    @Query("DELETE FROM category_patterns")
    suspend fun clearAllPatterns()
}

data class CategoryTotal(
    val category: String,
    val total: Int
)
