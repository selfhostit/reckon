package app

import (
	"testing"
	"time"
)

func TestStreakAtRisk(t *testing.T) {
	now := time.Date(2026, 11, 17, 19, 0, 0, 0, time.Local)
	cases := []struct {
		name string
		days map[string]float64
		want int
	}{
		{"no practice ever", nil, 0},
		{"already practised today", map[string]float64{"2026-11-16": 20, "2026-11-17": 10}, 0},
		{"three days in a row up to yesterday", map[string]float64{"2026-11-14": 10, "2026-11-15": 30, "2026-11-16": 10}, 3},
		{"a gap breaks the run", map[string]float64{"2026-11-13": 10, "2026-11-15": 30, "2026-11-16": 10}, 2},
		{"last practice two days ago: the streak is already gone", map[string]float64{"2026-11-15": 30}, 0},
		{"a day with no XP doesn't count", map[string]float64{"2026-11-16": 0}, 0},
	}
	for _, c := range cases {
		if got := streakAtRisk(c.days, now); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}
