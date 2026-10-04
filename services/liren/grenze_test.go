// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package liren

import (
	"encoding/json" //nolint:depguard // RawMessage ist ein SDK-Transporttyp, kein JSON-Parser.
	"errors"
	"testing"
)

func TestKommentarGrenze(t *testing.T) {
	for _, tc := range []struct {
		name   string
		offen  bool
		status int
	}{
		{"offen", true, 200}, {"geschlossen", false, 403}, {"Dienst ausgefallen", false, 503},
	} {
		t.Run(tc.name, func(t *testing.T) {
			body := json.RawMessage(`{"message":"Nicht gesendet."}`)
			err := pruefeKommentar(func(gate, von, an string) (bool, int, json.RawMessage) {
				if gate != "issue-comments" || von != "11" || an != "22" {
					t.Fatalf("Falscher Kommentarweg: %s %s %s", gate, von, an)
				}
				return tc.offen, tc.status, body
			}, 11, 22)
			if tc.offen {
				if err != nil {
					t.Fatal(err)
				}
				return
			}
			var sperre *SperrFehler
			if !errors.As(err, &sperre) || sperre.Status != tc.status || string(sperre.Body) != string(body) {
				t.Fatalf("Sperre muss unverändert zurückkommen: %v", err)
			}
		})
	}
}

func TestEigenerKommentarHatKeineAnderePerson(t *testing.T) {
	if err := pruefeKommentar(func(string, string, string) (bool, int, json.RawMessage) {
		t.Fatal("Ein Eigenkommentar darf keinen fremden Empfänger erfinden")
		return false, 503, nil
	}, 11, 11); err != nil {
		t.Fatal(err)
	}
}

func TestUnbekannterAufgabenautorBleibtGesperrt(t *testing.T) {
	if err := pruefeKommentar(func(string, string, string) (bool, int, json.RawMessage) {
		t.Fatal("Eine ungültige Person darf nicht an den Dienst gelangen")
		return true, 200, nil
	}, 11, 0); err == nil {
		t.Fatal("Kommentar ohne gültigen Aufgabenautor darf nicht weiterlaufen")
	}
}
