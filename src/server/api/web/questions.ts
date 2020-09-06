import archiver = require("archiver")
import * as fs from "fs"
import * as Router from "koa-router"
import * as mongoose from "mongoose"
import fetch from "node-fetch"
import { BASE_URL, ADMIN, TOOT_ORIGIN, TOOT_TOKEN} from "../../config"
import { IMastodonApp, IUser, Question, QuestionLike, User } from "../../db/index"
import { cutText } from "../../utils/cutText"
import { questionLogger } from "../../utils/questionLog"
import { requestOAuth } from "../../utils/requestOAuth"
import twitterClient from "../../utils/twitterClient"

const router = new Router()

router.get("/", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const questions = await Question.find({
        user: mongoose.Types.ObjectId(ctx.session!.user),
        answeredAt: null,
        isDeleted: {$ne: true},
    })
    var response=[]
    for(var i=0;i<questions.length;i++){
        var question=questions[i]
        if(!question.questionAnon){
            question.questionUser=null;
        }
        response.push(question)
    }
    ctx.body = JSON.stringify(response)
})

router.get("/count", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const count = await Question.find({
        user: mongoose.Types.ObjectId(ctx.session!.user),
        answeredAt: null,
        isDeleted: {$ne: true},
    }).count()
    ctx.body = {count}
})

router.get("/latest", async (ctx) => {
    if (ctx.session!.user){
        //Logined
        const me = await User.findById(ctx.session!.user)
        if (!me) return ctx.throw("not found", 404)
        var mine = me.acctLower
    } else {
        var mine = ""
    }
    let questions = await Question.find({
        answeredAt: {$ne: null},
        isDeleted: {$ne: true},
    }).limit(20).sort("-answeredAt")
    var response=[]
    for(var i=0;i<questions.length;i++){
        var question=questions[i]
        if(!question.questionAnon && mine != ADMIN){
            question.questionUser=null;
        }
        response.push(question)
    }
    ctx.body = response
})

router.get("/get_reported", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const me = await User.findById(ctx.session!.user)
    if (!me) return ctx.throw("not found", 404)
    if (me.acctLower != ADMIN) return ctx.throw("not admin", 403)
    let questions = await Question.find({
        isReported: true,
    }).limit(20).sort("-createdAt")
    var response=[]
    for(var i=0;i<questions.length;i++){
        var question=questions[i]
        response.push(question)
    }
    ctx.body = response
})

router.post("/:id/answer", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    if (question.isDeleted) return ctx.throw("not found", 404)
    // tslint:disable-next-line:triple-equals
    if (question.user._id != ctx.session!.user) return ctx.throw("not found", 404)
    if (question.answeredAt) return ctx.throw("alread answered", 400)
    question.answer = ctx.request.body.fields.answer
    if (question.answer!.length < 1) return ctx.throw("please input answer", 400)
    question.answeredAt = new Date()
    if (ctx.request.body.fields.isNSFW) question.isNSFW = true
    await question.save()
    ctx.body = {status: "ok"}
    const user = await User.findById(ctx.session!.user)
    if (!["public", "unlisted", "private"].includes(ctx.request.body.fields.visibility)) return
    if (!user) return
    const isTwitter = user.hostName === "twitter.com"
    const answerCharMax = isTwitter ? (110 - question.question.length) : 200
    const answerUrl = BASE_URL + "/@" + user!.acct + "/questions/" + question.id
    if (!isTwitter) { // Mastodon
        const body = {
            spoiler_text: "Q. " + question.question + " #quesdon",
            status: [
                "A. ",
                (question.answer!.length > 200
                    ? question.answer!.substring(0, 200) + "…(続きはリンク先で)"
                    : question.answer),
                "\n#quesdon ",
                answerUrl,
            ].join(""),
            visibility: ctx.request.body.fields.visibility,
        }
        if (question.questionAnon && question.questionUser) {
            var questionUserAcct = "@" + question.questionUser.acct
            if (question.questionUser.hostName === "twitter.com") {
                questionUserAcct = "https://twitter.com/" + question.questionUser.acct.replace(/:.+/, "")
            }
            body.status = "質問者: " + questionUserAcct + "\n" + body.status
        }
        if (question.isNSFW) {
            body.status = "Q. " + question.question + "\n" + body.status
            body.spoiler_text = "⚠ この質問は回答者がNSFWであると申告しています #quesdon"
        }
        var at=ctx.session!.token;
        if(!at){
            at=user.accessToken
        }
        if(~at.indexOf("misskey_")){
            var vis=null;
            if (body.visibility=="public") {
                vis="public";
            } else if (body.visibility=="unlisted") {
                vis="home";
            } else if (body.visibility=="unlisted") {
                vis="followers";
            } else {
                vis="public";
            }
            fetch("https://" + user!.acct.split("@")[1] + "/api/notes/create", {
                method: "POST",
                body: JSON.stringify({
                    i:at.split("_")[1],
                    text:body.status,
                    cw:body.spoiler_text,
                    visibility:vis
                }),
                headers: {
                    "Content-Type": "application/json",
                },
            })
        }else{
            fetch("https://" + user!.acct.split("@")[1] + "/api/v1/statuses", {
                method: "POST",
                body: JSON.stringify(body),
                headers: {
                    "Authorization": "Bearer " + user!.accessToken,
                    "Content-Type": "application/json",
                },
            })
        }
    } else {
        const strQ = cutText(question.question, 60)
        const strA = cutText(question.answer!, 120 - strQ.length)
        const [key, secret] = user.accessToken.split(":")
        const body = "Q. " + strQ + "\nA. " + strA + "\n#quesdon " + answerUrl
        requestOAuth(twitterClient, {
            url: "https://api.twitter.com/1.1/statuses/update.json",
            method: "POST",
            data: {status: body},
        }, {
            key, secret,
        })
    }
    // logging
    await questionLogger(ctx, question, "answer")
})

router.post("/:id/delete", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    // tslint:disable-next-line:triple-equals
    if (question.user._id != ctx.session!.user) return ctx.throw("not found", 404)
    question.isDeleted = true
    await question.save()
    ctx.body = {status: "ok"}
})

router.post("/:id/report", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    // tslint:disable-next-line:triple-equals
    if (question.user._id != ctx.session!.user) return ctx.throw("not found", 404)
    question.isDeleted = true
    question.isReported = true
    const body = JSON.parse(ctx.request.body)
    question.answer = body.report
    question.answeredAt = new Date()
    await question.save()
    ctx.body = {status: "ok"}
    fetch("https://" + TOOT_ORIGIN + "/api/v1/statuses", {
        method: "POST",
        body: JSON.stringify({
            visibility: "direct",
            status: '@' + ADMIN + ' 通報された質問があります',
        }),
        headers: {
        "Authorization": "Bearer " + TOOT_TOKEN,
        "Content-Type": "application/json",
        }
    })
})

router.post("/:id/like", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    if (!question.answeredAt) return ctx.throw("not found", 404)
    if (await QuestionLike.findOne({question})) return ctx.throw("already liked", 400)
    const like = new QuestionLike()
    like.question = question
    like.user = mongoose.Types.ObjectId(ctx.session!.user)
    await like.save()
    question.likesCount = await QuestionLike.find({question}).count()
    await question.save()
    ctx.body = {status: "ok"}
})

router.post("/:id/unlike", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const question = await Question.findById(ctx.params.id)
    const user = mongoose.Types.ObjectId(ctx.session!.user)
    if (!question) return ctx.throw("not found", 404)
    if (!question.answeredAt) return ctx.throw("not found", 404)
    const like = await QuestionLike.findOne({question, user})
    if (!like) return ctx.throw("not liked", 400)
    await like.remove()
    question.likesCount = await QuestionLike.find({question}).count()
    await question.save()
    ctx.body = {status: "ok"}
})

router.get("/:id", async (ctx) => {
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    if (!question.answeredAt) return ctx.throw("not found", 404)
    if (question.isDeleted) return ctx.throw("not found", 404)
    ctx.body = question
})

router.post("/all_delete", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    await Question.update({
        user: mongoose.Types.ObjectId(ctx.session!.user),
    }, {
        $set: {
            isDeleted: true,
        },
    }, {
        multi: true,
    })
    ctx.body = {status: "ok"}
})

router.post("/export", async (ctx) => {
    const user = await User.findById(ctx.session!.user)
    if (user == null) return ctx.throw("please login", 403)
    const base = user.acct.replace(/[^0-9a-zA-Z_]/g, "-")
    const dir = `quesdon-archive-${base}-${Math.floor(new Date().getTime() / 1000)}`
    console.log(base)
    const q = await Question.find({
        user: mongoose.Types.ObjectId(ctx.session!.user),
        answeredAt: {$ne: null},
        isDeleted: {$ne: true},
    })
    const answersJs = `// Tips: 最初の二行を削るとJSONになるぞ!ならなかったらゴメン
var answers =
${JSON.stringify(q, null, 4)}
`
    const userJs = `// Tips: 最初の二行を削るとJSONになるぞ!ならなかったらゴメン
var user =
${JSON.stringify(user, null, 4)}
`
    const archive = archiver("zip", {
        zlib: { level: 9 },
    })
    const p = new Promise((res) => archive.on("close", res))
    ctx.status = 200
    ctx.type = "zip"
    ctx.set("X-File-Name", dir)
    archive.pipe(ctx.res)
    archive.append(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<script src="answers.js"></script>
<script src="userInfo.js"></script>
<link rel="stylesheet" href="./static/bootstrap.min.css">
<script src="./static/moment.min.js"></script>
<script src="./static/main.js"></script>
<!-- Thanks for using Quesdon -->
</head>
<body>
<div id="app">Loading...</div>
</body>
</html>
`, { name: `${dir}/index.html` })
    archive.append(answersJs, { name: `${dir}/answers.js` })
    archive.append(userJs, { name: `${dir}/userInfo.js` })
    archive.append(
        fs.createReadStream(__dirname + "/../../../../static/bootstrap.min.css"),
        { name: `${dir}/static/bootstrap.min.css` },
    )
    archive.append(
        fs.createReadStream(__dirname + "/../../../../static/moment.min.js"),
        { name: `${dir}/static/moment.min.js` },
    )
    archive.append(
        fs.createReadStream(__dirname + "/../../../../static/main.js"),
        { name: `${dir}/static/main.js` },
    )
    archive.finalize()
    await p
})

router.post("/:id/nsfw/set", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const me = await User.findById(ctx.session!.user)
    if (!me) return ctx.throw("not found", 404)
    if (me.acctLower != ADMIN) return ctx.throw("not admin", 403)
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    question.isNSFW = true
    await question.save()
    ctx.body = {status: "ok"}
})
router.post("/:id/nsfw/send", async (ctx) => {
    if (!ctx.session!.user) return ctx.throw("please login", 403)
    const me = await User.findById(ctx.session!.user)
    if (!me) return ctx.throw("not found", 404)
    if (me.acctLower != ADMIN) return ctx.throw("not admin", 403)
    const question = await Question.findById(ctx.params.id)
    if (!question) return ctx.throw("not found", 404)
    if(question.questionUser){
        const questionUser = question.questionUser
        const user = question.user
        const url = BASE_URL + "/@" +user.acct + "/questions/" + question._id
        fetch("https://" + TOOT_ORIGIN + "/api/v1/statuses", {
            method: "POST",
            body: JSON.stringify({
                visibility: "direct",
                status: "@"+questionUser.acctLower+" 質問が利用規約に反するためNSFWに設定されました。次回以降凍結される可能性がありますのでご注意下さい。\n該当の質問" + url,
            }),
            headers: {
            "Authorization": "Bearer " + TOOT_TOKEN,
            "Content-Type": "application/json",
            }
        })
        fetch("https://" + TOOT_ORIGIN + "/api/v1/statuses", {
            method: "POST",
            body: JSON.stringify({
                visibility: "direct",
                status: "@"+user.acctLower+" 質問が利用規約に反するためNSFWに設定されました。次回以降凍結される可能性がありますのでご注意下さい。\n該当の質問" + url,
            }),
            headers: {
            "Authorization": "Bearer " + TOOT_TOKEN,
            "Content-Type": "application/json",
            }
        })
        ctx.body = {status: "ok"}
    }else{
        ctx.body = {status: "error"}
    }
    
})

export default router
