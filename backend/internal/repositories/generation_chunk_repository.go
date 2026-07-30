package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type GenerationChunkRepository interface {
	CreateBatch(chunks []models.GenerationChunk) error
	GetByID(id string) (*models.GenerationChunk, error)
	GetByJobID(jobID string) ([]models.GenerationChunk, error)
	GetCompletedByJobID(jobID string) ([]models.GenerationChunk, error)
	MarkProcessing(id string, attempt int) error
	MarkCompleted(id string, cards datatypes.JSON, attempt int) error
	MarkFailed(id string, errMsg string, attempt int) error
}

type generationChunkRepository struct{ db *gorm.DB }

func NewGenerationChunkRepository(db *gorm.DB) GenerationChunkRepository {
	return &generationChunkRepository{db: db}
}

func (r *generationChunkRepository) CreateBatch(chunks []models.GenerationChunk) error {
	if len(chunks) == 0 {
		return nil
	}
	return r.db.Create(&chunks).Error
}

func (r *generationChunkRepository) GetByID(id string) (*models.GenerationChunk, error) {
	var c models.GenerationChunk
	if err := r.db.First(&c, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("generation chunk not found")
		}
		return nil, err
	}
	return &c, nil
}

func (r *generationChunkRepository) GetByJobID(jobID string) ([]models.GenerationChunk, error) {
	var chunks []models.GenerationChunk
	if err := r.db.Where("job_id = ?", jobID).Order("chunk_index ASC").Find(&chunks).Error; err != nil {
		return nil, err
	}
	return chunks, nil
}

func (r *generationChunkRepository) GetCompletedByJobID(jobID string) ([]models.GenerationChunk, error) {
	var chunks []models.GenerationChunk
	if err := r.db.Where("job_id = ? AND status = ?", jobID, models.GenerationChunkStatusCompleted).
		Order("chunk_index ASC").Find(&chunks).Error; err != nil {
		return nil, err
	}
	return chunks, nil
}

func (r *generationChunkRepository) MarkProcessing(id string, attempt int) error {
	return r.db.Model(&models.GenerationChunk{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":  models.GenerationChunkStatusProcessing,
		"attempt": attempt,
	}).Error
}

func (r *generationChunkRepository) MarkCompleted(id string, cards datatypes.JSON, attempt int) error {
	return r.db.Model(&models.GenerationChunk{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":  models.GenerationChunkStatusCompleted,
		"cards":   cards,
		"attempt": attempt,
		"error":   "",
	}).Error
}

func (r *generationChunkRepository) MarkFailed(id string, errMsg string, attempt int) error {
	return r.db.Model(&models.GenerationChunk{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":  models.GenerationChunkStatusFailed,
		"error":   errMsg,
		"attempt": attempt,
	}).Error
}
