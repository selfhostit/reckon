package app_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tests"
)

// addSession saves a finished lesson for a user.
func addSession(t testing.TB, a core.App, user string) *core.Record {
	c, err := a.FindCollectionByNameOrId("practice_sessions")
	if err != nil {
		t.Fatal(err)
	}
	s := core.NewRecord(c)
	s.Load(map[string]any{
		"user": user, "kind": "practice", "family": "series", "level": 2, "level_after": 3,
		"started": "2026-11-17 10:00:00.000Z", "ended": "2026-11-17 10:04:00.000Z",
		"items": []any{map[string]any{"given": 47, "correct": true, "ms": 5200}}, "result": map[string]any{"correct": 7, "answered": 8},
	})
	if err := a.Save(s); err != nil {
		t.Fatal(err)
	}
	return s
}

// Practice is private: each person reads and writes only their own, the owner included.
func TestPracticeIsPrivate(t *testing.T) {
	session := `{"user":"BOB","kind":"test","mode":"quick","started":"2026-11-17 11:00:00.000Z","ended":"2026-11-17 11:10:00.000Z","items":[],"result":{"stanine":5}}`
	cases := []struct {
		name, who, method, url, body string
		status                       int
		want                         string
	}{
		{"a member saves their own session", "bob", http.MethodPost, "/api/collections/practice_sessions/records", session, http.StatusOK, `"stanine":5`},
		{"nobody saves a session for someone else", "ada", http.MethodPost, "/api/collections/practice_sessions/records", session, http.StatusBadRequest, `"data":{}`},
		{"the owner can't list a member's sessions", "ada", http.MethodGet, "/api/collections/practice_sessions/records", "", http.StatusOK, `"totalItems":1`},
		{"a member can't open the owner's session", "bob", http.MethodGet, "/api/collections/practice_sessions/records/ADA_SESSION", "", http.StatusNotFound, `"data":{}`},
		{"a finished session can't be edited", "ada", http.MethodPatch, "/api/collections/practice_sessions/records/ADA_SESSION", `{"result":{"stanine":9}}`, http.StatusForbidden, `"data":{}`},
		{"signed-out visitors see no sessions", "", http.MethodGet, "/api/collections/practice_sessions/records", "", http.StatusOK, `"totalItems":0`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			a := newApp(t)
			ada, adaToken := addUser(t, a, "ada@example.com", "owner")
			bob, bobToken := addUser(t, a, "bob@example.com", "member")
			addSession(t, a, bob.Id) // the owner must not see this one
			adaSession := addSession(t, a, ada.Id).Id
			s := tests.ApiScenario{
				Name:            c.name,
				Method:          c.method,
				URL:             strings.ReplaceAll(c.url, "ADA_SESSION", adaSession),
				ExpectedStatus:  c.status,
				ExpectedContent: []string{c.want},
				TestAppFactory:  func(testing.TB) *tests.TestApp { return a },
			}
			if c.body != "" {
				s.Body = strings.NewReader(strings.ReplaceAll(c.body, "BOB", bob.Id))
			}
			switch c.who {
			case "ada":
				s.Headers = map[string]string{"Authorization": adaToken}
			case "bob":
				s.Headers = map[string]string{"Authorization": bobToken}
			}
			s.Test(t)
		})
	}
}

func TestProgressIsOnePerPerson(t *testing.T) {
	a := newApp(t)
	defer a.Cleanup()
	ada, _ := addUser(t, a, "ada@example.com", "owner")
	c, err := a.FindCollectionByNameOrId("progress")
	if err != nil {
		t.Fatal(err)
	}
	for i := range 2 {
		p := core.NewRecord(c)
		p.Load(map[string]any{"user": ada.Id, "xp": 10, "daily_goal": 50, "days": map[string]int{"2026-11-17": 10}})
		err := a.Save(p)
		if i == 0 && err != nil {
			t.Fatal(err)
		}
		if i == 1 && err == nil {
			t.Fatal("a second progress record for the same person was saved")
		}
	}
}

func TestDeletingAPersonDeletesTheirPractice(t *testing.T) {
	a := newApp(t)
	defer a.Cleanup()
	bob, _ := addUser(t, a, "bob@example.com", "member")
	addSession(t, a, bob.Id)
	if err := a.Delete(bob); err != nil {
		t.Fatal(err)
	}
	left, err := a.FindRecordsByFilter("practice_sessions", "", "", 0, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(left) != 0 {
		t.Fatalf("%d sessions left after their person was deleted", len(left))
	}
}
