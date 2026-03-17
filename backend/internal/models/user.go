package models

import "time"

type User struct {
	ID                    string     `json:"id"`
	Email                 string     `json:"email"`
	PasswordHash          string     `json:"-"`
	Name                  string     `json:"name"`
	Timezone              *string    `json:"timezone"`
	UnitsPreference       string     `json:"units_preference"`
	MaxHeartRate          int        `json:"max_heart_rate"`
	WeeklyEffortGoal      int        `json:"weekly_effort_goal"`
	BirthYear             *int       `json:"birth_year,omitempty"`
	HeightCm              *float64   `json:"height_cm,omitempty"`
	WeightKg              *float64   `json:"weight_kg,omitempty"`
	ProfileCompleted      bool       `json:"profile_completed"`
	SubscriptionTier      string     `json:"subscription_tier"`
	SubscriptionStartedAt *time.Time `json:"subscription_started_at,omitempty"`
	SubscriptionExpiresAt *time.Time `json:"subscription_expires_at,omitempty"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

func (u *User) ToResponse() UserResponse {
	r := UserResponse{
		ID:                    u.ID,
		Email:                 u.Email,
		Name:                  u.Name,
		Timezone:              u.Timezone,
		UnitsPreference:       u.UnitsPreference,
		MaxHeartRate:          u.MaxHeartRate,
		WeeklyEffortGoal:      u.WeeklyEffortGoal,
		BirthYear:             u.BirthYear,
		HeightCm:              u.HeightCm,
		WeightKg:              u.WeightKg,
		ProfileCompleted:      u.ProfileCompleted,
		SubscriptionTier:      u.SubscriptionTier,
		SubscriptionExpiresAt: u.SubscriptionExpiresAt,
	}
	r.ApplyEffectiveTier()
	return r
}

type UserResponse struct {
	ID                    string     `json:"id"`
	Email                 string     `json:"email"`
	Name                  string     `json:"name"`
	Timezone              *string    `json:"timezone,omitempty"`
	UnitsPreference       string     `json:"units_preference"`
	MaxHeartRate          int        `json:"max_heart_rate"`
	WeeklyEffortGoal      int        `json:"weekly_effort_goal"`
	BirthYear             *int       `json:"birth_year,omitempty"`
	HeightCm              *float64   `json:"height_cm,omitempty"`
	WeightKg              *float64   `json:"weight_kg,omitempty"`
	ProfileCompleted      bool       `json:"profile_completed"`
	SubscriptionTier      string     `json:"subscription_tier"`
	SubscriptionExpiresAt *time.Time `json:"subscription_expires_at,omitempty"`
}

// ApplyEffectiveTier downgrades SubscriptionTier to "free" if the
// subscription has expired. This keeps the API response consistent
// with the backend tier checks in the usage service.
func (u *UserResponse) ApplyEffectiveTier() {
	if u.SubscriptionTier == "premium" && u.SubscriptionExpiresAt != nil && time.Now().After(*u.SubscriptionExpiresAt) {
		u.SubscriptionTier = "free"
	}
}
