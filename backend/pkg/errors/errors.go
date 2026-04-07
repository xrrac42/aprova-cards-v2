package errors

import "fmt"

type AppError struct {
	Code    string
	Message string
	Status  int
}

func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Erros comuns
var (
	ErrNotFound = &AppError{
		Code:    "NOT_FOUND",
		Message: "Resource not found",
		Status:  404,
	}
	ErrInvalidInput = &AppError{
		Code:    "INVALID_INPUT",
		Message: "Invalid input provided",
		Status:  400,
	}
	ErrUnauthorized = &AppError{
		Code:    "UNAUTHORIZED",
		Message: "Unauthorized access",
		Status:  401,
	}
	ErrForbidden = &AppError{
		Code:    "FORBIDDEN",
		Message: "Forbidden access",
		Status:  403,
	}
	ErrConflict = &AppError{
		Code:    "CONFLICT",
		Message: "Resource already exists",
		Status:  409,
	}
	ErrInternalServer = &AppError{
		Code:    "INTERNAL_SERVER_ERROR",
		Message: "Internal server error",
		Status:  500,
	}
)

func NewAppError(code, message string, status int) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Status:  status,
	}
}
