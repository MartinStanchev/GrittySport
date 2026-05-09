package notifications

// NotifType defines a notification type in the registry.
// DefaultEnabled is intentionally false on every type — under GDPR Art. 6(1)(a)
// each push channel is its own opt-in. The OS notification permission prompt
// only allows the *delivery* channel; it isn't consent for any specific type.
// Users flip each type on deliberately in Settings.
type NotifType struct {
	Key             string `json:"key"`
	Label           string `json:"label"`
	Description     string `json:"description"`
	RequiresPremium bool   `json:"requires_premium"`
	DefaultEnabled  bool   `json:"default_enabled"`
	DefaultTitle    string `json:"-"`
}

// Registry is the canonical list of all notification types.
// Adding a new notification = append here + call SendToUser from the trigger point.
var Registry = []NotifType{
	{
		Key:             "workout_reminder",
		Label:           "Workout Reminders",
		Description:     "Daily reminder when you have a scheduled activity",
		RequiresPremium: false,
		DefaultEnabled:  false,
		DefaultTitle:    "Workout Today",
	},
	{
		Key:             "post_workout_review",
		Label:           "Post-Workout Reviews",
		Description:     "Grit's analysis after you complete a workout",
		RequiresPremium: true,
		DefaultEnabled:  false,
		DefaultTitle:    "Grit",
	},
	{
		Key:             "missed_workout",
		Label:           "Missed Workout Check-Ins",
		Description:     "Grit checks in when you miss a scheduled workout",
		RequiresPremium: true,
		DefaultEnabled:  false,
		DefaultTitle:    "Grit",
	},
	{
		Key:             "pre_workout_checkin",
		Label:           "Pre-Workout Check-Ins",
		Description:     "Grit checks in before your workouts to ask about energy and sleep",
		RequiresPremium: true,
		DefaultEnabled:  false,
		DefaultTitle:    "Grit",
	},
}

// registryMap is a lookup index built from Registry.
var registryMap map[string]NotifType

func init() {
	registryMap = make(map[string]NotifType, len(Registry))
	for _, nt := range Registry {
		registryMap[nt.Key] = nt
	}
}

// Lookup returns the NotifType for a given key, or false if not found.
func Lookup(key string) (NotifType, bool) {
	nt, ok := registryMap[key]
	return nt, ok
}
