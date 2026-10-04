// Copyright 2026 The Gitea Authors. All rights reserved.
// SPDX-License-Identifier: MIT

package repo

import (
	"io"
	"net/http"
	"strconv"

	"gitea.dev/models/db"
	issues_model "gitea.dev/models/issues"
	access_model "gitea.dev/models/perm/access"
	"gitea.dev/services/context"
	liren_service "gitea.dev/services/liren"

	"xorm.io/builder"
)

func LirenSitzung(ctx *context.Context) {
	var id any
	if ctx.Doer != nil {
		id = strconv.FormatInt(ctx.Doer.ID, 10)
	}
	ctx.JSON(http.StatusOK, map[string]any{"userId": id})
}

func LirenRoute(ctx *context.Context) {
	if ctx.Doer == nil {
		ctx.JSON(http.StatusUnauthorized, map[string]string{"error": "UNAUTHORIZED"})
		return
	}
	issue, err := issues_model.GetIssueByID(ctx, ctx.PathParamInt64("issueID"))
	if err != nil || issue.LoadRepo(ctx) != nil {
		ctx.HTTPError(http.StatusNotFound)
		return
	}
	permission, err := access_model.GetDoerRepoPermission(ctx, issue.Repo, ctx.Doer)
	if err != nil || !permission.CanReadIssuesOrPulls(issue.IsPull) {
		ctx.HTTPError(http.StatusNotFound)
		return
	}
	body, err := io.ReadAll(http.MaxBytesReader(ctx.Resp, ctx.Req.Body, 64*1024))
	if err != nil {
		ctx.JSON(http.StatusRequestEntityTooLarge, map[string]string{"error": "BODY_TOO_LARGE"})
		return
	}
	status, antwort := liren_service.Route(ctx.Req, ctx.PathParam("lirenRoute"), strconv.FormatInt(ctx.Doer.ID, 10), body, func(a liren_service.Ankunft) bool {
		from, err := strconv.ParseInt(a.From, 10, 64)
		if err != nil || from <= 0 || a.To != strconv.FormatInt(ctx.Doer.ID, 10) || a.Gate == nil {
			return false
		}
		if *a.Gate == "issue-publications" {
			return from == issue.PosterID
		}
		if *a.Gate != "issue-comments" || issue.PosterID != ctx.Doer.ID {
			return false
		}
		exists, err := db.Exist[issues_model.Comment](ctx, builder.Eq{"issue_id": issue.ID, "poster_id": from, "type": issues_model.CommentTypeComment})
		return err == nil && exists
	})
	ctx.JSON(status, antwort)
}
