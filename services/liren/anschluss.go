// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package liren

import (
	"context"
	"encoding/json" //nolint:depguard // RawMessage ist ein SDK-Transporttyp, kein JSON-Parser.
	"errors"
	"net/http"
	"net/url"
	"os"
	"sync"

	sdk "github.com/liquidschoolakguen/NM/packages/liren-go"
)

type (
	ankunftKey       struct{}
	Ankunft          = sdk.Ankunft
	AnkunftsPruefung func(Ankunft) bool
)

type konfiguration struct {
	dienst            *sdk.Dienst
	app, widgetOrigin string
}

var lade = sync.OnceValues(func() (*konfiguration, error) { return neueKonfiguration(os.Getenv) })

func neueKonfiguration(lookup func(string) string) (*konfiguration, error) {
	wert := lookup("LIREN_ENABLED")
	if wert == "" || wert == "false" {
		return &konfiguration{}, nil
	}
	if wert != "true" || lookup("REFERENZ_MODUS") != "lokal" {
		return nil, errors.New("Liren in diesem Beispielfork verlangt LIREN_ENABLED=true und REFERENZ_MODUS=lokal")
	}
	app, origin := lookup("LIREN_APP"), lookup("LIREN_WIDGET_ORIGIN")
	parsed, err := url.Parse(origin)
	if app == "" || err != nil || parsed.Host == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.Path != "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("LIREN_APP und ein vollständiger LIREN_WIDGET_ORIGIN ohne Pfad sind erforderlich")
	}
	dienst, err := sdk.Neu(lookup("LIREN_DIENST_URL"), lookup("LIREN_DIENST_SECRET"), func(r *http.Request, a sdk.Ankunft) bool {
		pruefung, _ := r.Context().Value(ankunftKey{}).(AnkunftsPruefung)
		return pruefung != nil && pruefung(a)
	})
	if err != nil {
		return nil, err
	}
	return &konfiguration{dienst: dienst, app: app, widgetOrigin: origin}, nil
}

func Initialisiere() error { _, err := lade(); return err }

func AppKonfiguration() (app, origin string, aktiv bool) {
	config, err := lade()
	if err != nil || config.dienst == nil {
		return "", "", false
	}
	return config.app, config.widgetOrigin, true
}

func PruefeKommentar(von, an int64) error {
	config, err := lade()
	if err != nil {
		return &SperrFehler{Status: http.StatusServiceUnavailable, Body: json.RawMessage(`{"error":"LIREN_UNAVAILABLE","message":"Liren ist gerade nicht erreichbar. Der Kommentar bleibt gesperrt."}`)}
	}
	if config.dienst == nil {
		return nil
	}
	return pruefeKommentar(config.dienst.Sperre, von, an)
}

func Route(r *http.Request, name, nutzer string, body json.RawMessage, pruefung AnkunftsPruefung) (int, json.RawMessage) {
	config, err := lade()
	if err != nil || config.dienst == nil {
		return http.StatusServiceUnavailable, json.RawMessage(`{"error":"LIREN_UNAVAILABLE"}`)
	}
	r = r.WithContext(context.WithValue(r.Context(), ankunftKey{}, pruefung))
	return config.dienst.Route(r, name, nutzer, body)
}
