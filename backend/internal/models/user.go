package models

import "time"

type User struct {
	ID               string    `json:"id"`
	Email            string    `json:"email"`
	PasswordHash     string    `json:"-"`
	Name             string    `json:"name"`
	Timezone         *string   `json:"timezone"`
	UnitsPreference  string    `json:"units_preference"`
	MaxHeartRate     int       `json:"max_heart_rate"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (u *User) ToResponse() UserResponse {
	return UserResponse{
		ID:              u.ID,
		Email:           u.Email,
		Name:            u.Name,
		Timezone:        u.Timezone,
		UnitsPreference: u.UnitsPreference,
		MaxHeartRate:    u.MaxHeartRate,
	}
}

type UserResponse struct {
	ID              string  `json:"id"`
	Email           string  `json:"email"`
	Name            string  `json:"name"`
	Timezone        *string `json:"timezone,omitempty"`
	UnitsPreference string  `json:"units_preference"`
	MaxHeartRate    int     `json:"max_heart_rate"`
}
