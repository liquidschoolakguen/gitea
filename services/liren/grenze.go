// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package liren

import (
	"encoding/json" //nolint:depguard // RawMessage ist ein SDK-Transporttyp, kein JSON-Parser.
	"net/http"
	"strconv"
)

type SperrFehler struct {
	Status int
	Body   json.RawMessage
}

func (e *SperrFehler) Error() string { return "Der Kommentar wurde nicht gesendet." }

func pruefeKommentar(sperre func(string, string, string) (bool, int, json.RawMessage), von, an int64) error {
	if von <= 0 || an <= 0 {
		return &SperrFehler{Status: http.StatusNotFound, Body: json.RawMessage(`{"error":"UNKNOWN_USER","message":"Das App-Konto ist nicht verfügbar."}`)}
	}
	if von == an {
		return nil
	}
	offen, status, body := sperre("issue-comments", strconv.FormatInt(von, 10), strconv.FormatInt(an, 10))
	if offen {
		return nil
	}
	return &SperrFehler{Status: status, Body: body}
}
