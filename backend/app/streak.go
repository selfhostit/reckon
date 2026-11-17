package app

import (
	"fmt"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"github.com/selfhostit/reckon/jobs"
	"github.com/selfhostit/reckon/push"
)

// An evening nudge for people who turned reminders on: they practised
// yesterday but not yet today, so their streak ends at midnight.
func registerStreakReminder(app core.App) {
	jobs.MustAdd(app, "streak-reminder", "0 19 * * *", func(app core.App) error {
		return sendStreakReminders(app, time.Now())
	})
}

func sendStreakReminders(app core.App, now time.Time) error {
	list, err := app.FindRecordsByFilter("progress", "reminders = true", "", 0, 0)
	if err != nil {
		return err
	}
	for _, p := range list {
		var days map[string]float64
		if err := p.UnmarshalJSONField("days", &days); err != nil {
			continue
		}
		if n := streakAtRisk(days, now); n > 0 {
			push.ToUser(app, p.GetString("user"), push.Message{
				Title: fmt.Sprintf("Keep your %d-day streak", n),
				Body:  "One short lesson today keeps it going.",
				URL:   "/",
				Tag:   "streak",
			})
		}
	}
	return nil
}

// streakAtRisk is the length of the streak that ends tonight: the run of days
// with XP up to yesterday, if there is none yet today. 0 means nothing to remind.
func streakAtRisk(days map[string]float64, now time.Time) int {
	if days[now.Format(time.DateOnly)] > 0 {
		return 0
	}
	n := 0
	for d := now.AddDate(0, 0, -1); days[d.Format(time.DateOnly)] > 0; d = d.AddDate(0, 0, -1) {
		n++
	}
	return n
}
