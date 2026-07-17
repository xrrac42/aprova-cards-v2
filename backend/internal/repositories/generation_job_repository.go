package repositories

import (
	"errors"

	"github.com/approva-cards/back-aprova-cards/internal/models"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type GenerationJobRepository interface {
	Create(job *models.GenerationJob) error
	GetByID(id string) (*models.GenerationJob, error)
	UpdateStatus(id, status string) error
	SetResult(id string, result datatypes.JSON, reviewErr string) error
	SetFailed(id, errMsg string) error
	// IncrementCompletedChunks atomically bumps completed_chunks and returns
	// the updated (completed, total) counts.
	IncrementCompletedChunks(id string) (completed, total int, err error)
	// TryClaimReduce atomically marks the job as having its reduce step
	// enqueued. Returns true only for the single caller that "wins" the race.
	TryClaimReduce(id string) (claimed bool, err error)
}

type generationJobRepository struct{ db *gorm.DB }

func NewGenerationJobRepository(db *gorm.DB) GenerationJobRepository {
	return &generationJobRepository{db: db}
}

func (r *generationJobRepository) Create(job *models.GenerationJob) error {
	return r.db.Create(job).Error
}

func (r *generationJobRepository) GetByID(id string) (*models.GenerationJob, error) {
	var j models.GenerationJob
	if err := r.db.First(&j, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("generation job not found")
		}
		return nil, err
	}
	return &j, nil
}

func (r *generationJobRepository) UpdateStatus(id, status string) error {
	return r.db.Model(&models.GenerationJob{}).Where("id = ?", id).Update("status", status).Error
}

func (r *generationJobRepository) SetResult(id string, result datatypes.JSON, reviewErr string) error {
	return r.db.Model(&models.GenerationJob{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       models.GenerationJobStatusCompleted,
		"result":       result,
		"review_error": reviewErr,
		"completed_at": gorm.Expr("now()"),
	}).Error
}

func (r *generationJobRepository) SetFailed(id, errMsg string) error {
	return r.db.Model(&models.GenerationJob{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":       models.GenerationJobStatusFailed,
		"error":        errMsg,
		"completed_at": gorm.Expr("now()"),
	}).Error
}

func (r *generationJobRepository) IncrementCompletedChunks(id string) (completed, total int, err error) {
	row := r.db.Raw(
		`UPDATE generation_jobs SET completed_chunks = completed_chunks + 1, updated_at = now() WHERE id = ? RETURNING completed_chunks, total_chunks`,
		id,
	).Row()
	if err := row.Scan(&completed, &total); err != nil {
		return 0, 0, err
	}
	return completed, total, nil
}

func (r *generationJobRepository) TryClaimReduce(id string) (bool, error) {
	tx := r.db.Exec(
		`UPDATE generation_jobs SET reduce_enqueued_at = now() WHERE id = ? AND reduce_enqueued_at IS NULL`,
		id,
	)
	if tx.Error != nil {
		return false, tx.Error
	}
	return tx.RowsAffected == 1, nil
}
