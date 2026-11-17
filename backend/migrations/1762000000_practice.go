package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

// Each person's practice: their levels, XP and streak ("progress", one record
// each) and every lesson and mock test they finish ("practice_sessions"). Both
// are private: nobody else, not even the owner, can read them. A finished
// session is a record of what happened, so it can't be edited, only deleted.
func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}
		own := types.Pointer(`user = @request.auth.id`)
		create := types.Pointer(`@request.auth.collectionName = "users" && @request.body.user = @request.auth.id`)

		progress := core.NewBaseCollection("progress")
		progress.Fields.Add(
			&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.NumberField{Name: "xp", OnlyInt: true, Min: types.Pointer(0.0), Max: types.Pointer(100_000_000.0)},
			&core.NumberField{Name: "daily_goal", OnlyInt: true, Min: types.Pointer(0.0), Max: types.Pointer(1000.0)},
			// level per question type, {"series": {"level": 3}, ...}
			&core.JSONField{Name: "skills", MaxSize: 2_000},
			// XP earned per day, {"2026-11-17": 60, ...}; the web app keeps about a year
			&core.JSONField{Name: "days", MaxSize: 32_000},
			// an evening notification when the streak is about to break
			&core.BoolField{Name: "reminders"},
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
		)
		progress.AddIndex("idx_progress_user", true, "user", "")
		progress.ListRule, progress.ViewRule, progress.DeleteRule = own, own, own
		progress.CreateRule = create
		progress.UpdateRule = types.Pointer(`user = @request.auth.id && (@request.body.user:isset = false || @request.body.user = @request.auth.id)`)
		if err := app.Save(progress); err != nil {
			return err
		}

		sessions := core.NewBaseCollection("practice_sessions")
		sessions.Fields.Add(
			&core.RelationField{Name: "user", CollectionId: users.Id, Required: true, MaxSelect: 1, CascadeDelete: true},
			&core.SelectField{Name: "kind", Values: []string{"practice", "test"}, MaxSelect: 1, Required: true},
			// which skill a lesson practised (mix: all four)
			&core.SelectField{Name: "family", Values: []string{"series", "grid", "shapes", "pairs", "mix"}, MaxSelect: 1},
			// a mock test's length
			&core.SelectField{Name: "mode", Values: []string{"full", "quick"}, MaxSelect: 1},
			&core.NumberField{Name: "level", OnlyInt: true, Min: types.Pointer(0.0), Max: types.Pointer(9.0)},
			&core.NumberField{Name: "level_after", OnlyInt: true, Min: types.Pointer(0.0), Max: types.Pointer(9.0)},
			&core.DateField{Name: "started", Required: true},
			&core.DateField{Name: "ended", Required: true},
			// every question, the answer given, the time taken and any help used
			&core.JSONField{Name: "items", MaxSize: 400_000},
			// the score: correct answers, and for a test the stanine and its margin
			&core.JSONField{Name: "result", MaxSize: 4_000},
			&core.AutodateField{Name: "created", OnCreate: true},
		)
		sessions.AddIndex("idx_practice_sessions_user", false, "user, started", "")
		sessions.ListRule, sessions.ViewRule, sessions.DeleteRule = own, own, own
		sessions.CreateRule = create
		sessions.UpdateRule = nil // superusers only
		return app.Save(sessions)
	}, func(app core.App) error {
		for _, name := range []string{"practice_sessions", "progress"} {
			c, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				return err
			}
			if err := app.Delete(c); err != nil {
				return err
			}
		}
		return nil
	})
}
