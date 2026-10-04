// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package liren

import "testing"

func TestLirenStartgrenze(t *testing.T) {
	basis := map[string]string{"LIREN_ENABLED": "true", "REFERENZ_MODUS": "lokal", "LIREN_APP": "gitea-referenz", "LIREN_WIDGET_ORIGIN": "http://localhost:5178", "LIREN_DIENST_URL": "http://127.0.0.1:3003", "LIREN_DIENST_SECRET": "12345678901234567890123456789012"}
	for _, tc := range []struct{ key, value string }{
		{"REFERENZ_MODUS", ""},
		{"REFERENZ_MODUS", "production"},
		{"REFERENZ_MODUS", "loakl"},
		{"LIREN_ENABLED", "TRUE"},
		{"LIREN_APP", ""},
		{"LIREN_WIDGET_ORIGIN", "https://widget.invalid/pfad"},
		{"LIREN_DIENST_SECRET", ""},
		{"LIREN_DIENST_URL", "http://fremd.invalid"},
	} {
		t.Run(tc.key+"/"+tc.value, func(t *testing.T) {
			_, err := neueKonfiguration(func(key string) string {
				if key == tc.key {
					return tc.value
				}
				return basis[key]
			})
			if err == nil {
				t.Fatal("Ungültiger Start muss scheitern")
			}
		})
	}
	config, err := neueKonfiguration(func(key string) string { return basis[key] })
	if err != nil || config.dienst == nil {
		t.Fatalf("Vollständige lokale Konfiguration fehlt: %v", err)
	}
	config, err = neueKonfiguration(func(string) string { return "" })
	if err != nil || config.dienst != nil {
		t.Fatal("Ohne Einschalten bleibt der ursprüngliche Gitea-Stand erhalten")
	}
}
