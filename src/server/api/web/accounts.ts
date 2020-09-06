import * as Koa from "koa"
import * as Router from "koa-router"
import * as mongoose from "mongoose"
import fetch from "node-fetch"
import * as parseLinkHeader from "parse-link-header"
import { Link, Links } from "parse-link-header"
import { QUESTION_TEXT_MAX_LENGTH } from "../../../common/const"
import {
  BASE_URL,
  PUSHBULLET_CLIENT_ID,
  PUSHBULLET_CLIENT_SECRET,
  TOOT_ORIGIN,
  TOOT_TOKEN,
  ADMIN
} from "../../config"
import { Question, User } from "../../db/index"
import { questionLogger } from "../../utils/questionLog"

const router = new Router()

router.get("/verify_credentials", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  ctx.body = user
})

router.get("/followers", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  if (user.hostName === "twitter.com") {
    return { max_id: undefined, accounts: [] }
  }
  var at = ctx.session!.token
  if (!at) {
    at = user.accessToken
  }
  var max_id = ""
  if (~at.indexOf("misskey_")) {
    const instanceUrl = "https://" + user!.acct.split("@")[1]
    var body = JSON.stringify({
      username: user!.acct.split("@")[0],
      i: at.split("_")[1],
      limit: 100
    })
    if (ctx.query.max_id) {
      var body = JSON.stringify((JSON.parse(body).cursor = ctx.query.max_id))
    }
    const followersRes = await fetch(`${instanceUrl}/api/users/followers`, {
      method: "POST",
      body: body
    }).then(r => r.json())
    var followers: any[] = followersRes.users
    followers = followers
      .map(follower => (follower.username + "@" + follower.host) as string)
      .map(acct =>
        acct.includes(".") ? acct : acct + "@" + user!.acct.split("@")[1]
      )
      .map(acct => acct.toLowerCase())
    max_id = followersRes.next
  } else {
    if (null == /^\d+$/.exec(ctx.query.max_id || "0"))
      return ctx.throw("max_id is num only", 400)
    const instanceUrl = "https://" + user!.acct.split("@")[1]
    const myInfo = await fetch(
      instanceUrl + "/api/v1/accounts/verify_credentials",
      {
        headers: {
          Authorization: "Bearer " + at
        }
      }
    ).then(r => r.json())
    const param = ctx.query.max_id ? "&max_id=" + ctx.query.max_id : ""
    const followersRes = await fetch(
      `${instanceUrl}/api/v1/accounts/${myInfo.id}/followers?limit=80${param}`,
      {
        headers: {
          Authorization: "Bearer " + at
        }
      }
    )
    var followers: any[] = await followersRes.json()
    followers = followers
      .map(follower => follower.acct as string)
      .map(acct =>
        acct.includes("@") ? acct : acct + "@" + user!.acct.split("@")[1]
      )
      .map(acct => acct.toLowerCase())
    var max_id = (
      (parseLinkHeader(followersRes.headers.get("Link")!) || ({} as Links))
        .next || ({} as Link)
    ).max_id
  }
  const followersObject = await User.find({ acctLower: { $in: followers } })
  ctx.body = {
    accounts: followersObject,
    max_id
  }
})
router.post("/ban", async ctx => {
  const target = ctx.request.body
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const me = await User.findById(ctx.session!.user)
  if (!me) return ctx.throw("not found", 404)
  if (me.acctLower != ADMIN) return ctx.throw("not admin", 403)
  const user = await User.findOne({ acctLower: target.toLowerCase() })
  if (!user) return ctx.throw("not found", 404)
  user.isDeleted = true
  await user.save()

  await Question.update(
    {
      user: user
    },
    {
      $set: {
        isDeleted: true
      }
    },
    {
      multi: true
    }
  )

  ctx.body = { status: "ok" }
})
router.get("/all_users", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  if (user.acctLower != ADMIN) return ctx.throw("not admin", 403)
  if (user.hostName === "twitter.com") {
    return { max_id: undefined, accounts: [] }
  }
  const users = await User.find()
  ctx.body = users
})
router.get("/redirect/admin", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findOne({ isAdmin: true })
  if (!user) return ctx.throw("not found", 404)
  const admin = user.acct
  ctx.redirect("/@" + user.acct)
})

router.post("/update", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  user.description = ctx.request.body.fields.description
  user.questionBoxName = ctx.request.body.fields.questionBoxName
  user.allAnon = !!ctx.request.body.fields.allAnon
  user.stopNewQuestion = !!ctx.request.body.fields.stopNewQuestion
  await user.save()
  ctx.body = { status: "ok" }
})

router.get("/id/:id", async ctx => {
  const user = await User.findById(ctx.params.id)
  if (!user) return ctx.throw("not found", 404)
  if (user.hostName === "twitter.com") return ctx.throw("not found", 404)
  ctx.body = user
})

router.get("/pushbullet/redirect", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  ctx.redirect(
    "https://www.pushbullet.com/authorize" +
      "?client_id=" +
      PUSHBULLET_CLIENT_ID +
      "&redirect_uri=" +
      encodeURIComponent(BASE_URL + "/api/web/accounts/pushbullet/callback") +
      "&response_type=code" +
      "&scope=everything"
  )
})

router.get("/pushbullet/callback", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  const res = await fetch("https://api.pushbullet.com/oauth2/token", {
    method: "POST",
    body: JSON.stringify({
      client_id: PUSHBULLET_CLIENT_ID,
      client_secret: PUSHBULLET_CLIENT_SECRET,
      code: ctx.query.code,
      grant_type: "authorization_code"
    }),
    headers: {
      "Content-Type": "application/json"
    }
  }).then(r => r.json())
  if (res.error) {
    return ctx.throw(500, "pushbullet error: " + res.error.message)
  }
  user.pushbulletAccessToken = res.access_token
  await user.save()
  ctx.redirect("/my/settings")
})

router.post("/pushbullet/disconnect", async ctx => {
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const user = await User.findById(ctx.session!.user)
  if (!user) return ctx.throw("not found", 404)
  user.pushbulletAccessToken = null
  await user.save()
  ctx.body = { status: "ok" }
})

router.get("/:acct", async ctx => {
  if (ctx.params.acct.toLowerCase().endsWith("twitter.com"))
    return ctx.throw("twitter service is finished.", 404)
  const user = await User.findOne({ acctLower: ctx.params.acct.toLowerCase() })
  if (!user) return ctx.throw("not found", 404)
  ctx.body = user
})

router.post("/:acct/question", async ctx => {
  if (ctx.params.acct.toLowerCase().endsWith("twitter.com"))
    return ctx.throw("twitter service is finished.", 404)
  const questionString = ctx.request.body.fields.question
  if (questionString.length < 1) return ctx.throw("please input question", 400)
  if (questionString.length > QUESTION_TEXT_MAX_LENGTH)
    return ctx.throw("too long", 400)
  const user = await User.findOne({ acctLower: ctx.params.acct.toLowerCase() })
  if (!user) return ctx.throw("not found", 404)
  if (user.stopNewQuestion)
    return ctx.throw(400, "this user has stopped new question submit")
  const question = new Question()
  question.question = questionString
  question.user = user
  if (ctx.request.body.fields.noAnon || user.allAnon) {
    question.questionAnon = true
  }
  if (!ctx.session!.user) return ctx.throw("please login", 403)
  const questionUser = await User.findById(ctx.session!.user)
  if (!questionUser) return ctx.throw("not found", 404)
  question.questionUser = questionUser
  await question.save()
  // logging
  await questionLogger(ctx, question, "create")
  ctx.body = { status: "ok" }
  if (user.pushbulletAccessToken) {
    fetch("https://api.pushbullet.com/v2/pushes", {
      method: "POST",
      body: JSON.stringify({
        type: "link",
        body: "新しい質問です\nQ. " + question.question,
        url: BASE_URL + "/my/questions"
      }),
      headers: {
        "Access-Token": user.pushbulletAccessToken,
        "Content-Type": "application/json"
      }
    })
  }
  fetch("https://" + TOOT_ORIGIN + "/api/v1/statuses", {
    method: "POST",
    body: JSON.stringify({
      visibility: "direct",
      status:
        "@" +
        user.acctLower +
        " 新しい質問です\n" +
        BASE_URL +
        "/my/questions\nこの通知が不要の際はこのアカウントをミュートして下さい。"
    }),
    headers: {
      Authorization: "Bearer " + TOOT_TOKEN,
      "Content-Type": "application/json"
    }
  })
})

router.post("/:acct/import", async ctx => {
  const questionStringJSON = ctx.request.body.fields.question
  const questionStringArray = JSON.parse(questionStringJSON).questions
  if (JSON.parse(questionStringJSON).version != "reverse")
    return ctx.throw("check json type", 400)
  var questionString = ""
  var sel = 0
  for (var i = questionStringArray.length; i > 0; i--) {
    sel = i - 1
    questionString = questionStringArray[sel]
    if (questionString.length < 1) return ctx.throw("too short", 400)
    if (questionString.length > QUESTION_TEXT_MAX_LENGTH)
      return ctx.throw("too long", 400)
    var user = await User.findOne({ acctLower: ctx.params.acct.toLowerCase() })
    if (!user) return ctx.throw("not found", 404)
    var question = new Question()
    question.question = questionString
    question.user = user
    await question.save()
    // logging
    await questionLogger(ctx, question, "create")
  }
  ctx.body = { status: "ok" }
})

const getAnswers = async (ctx: Koa.Context) => {
  if (ctx.params.acct.toLowerCase().endsWith("twitter.com"))
    return ctx.throw("twitter service is finished.", 404)
  const user = await User.findOne({ acctLower: ctx.params.acct.toLowerCase() })
  if (!user) return ctx.throw("not found", 404)
  const questions = await Question.find({
    user,
    answeredAt: { $ne: null },
    isDeleted: { $ne: true }
  }).sort("-answeredAt")
  ctx.body = questions.map(question => {
    if (!question.questionAnon) {
      question.questionUser = null
    }
    question.user = user
    return question
  })
}

router.get("/:acct/questions", getAnswers)
router.get("/:acct/answers", getAnswers)

export default router
