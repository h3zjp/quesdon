import * as React from "react"
import { Link } from "react-router-dom"
import { APIUser } from "../../../../api-interfaces"
import { apiFetch } from "../../../api-fetch"
import { me } from "../../../initial-state"
import { Title } from "../../common/title"
import { QuestionRemaining } from "../../question-remaining"
import { ListGroup, ListGroupItem } from "reactstrap"

export class PageMyIndex extends React.Component {
    render() {
        if (!me) return null
        return <div>
            <Title>マイページ</Title>
            <h1>マイページ</h1>
            <p>こんにちは、{me.name}さん!</p>
            <ListGroup>
                <Link to={`/@${me.acct}`}><ListGroupItem className="justify-content-between">あなたのプロフィール</ListGroupItem></Link>
                <Link to="/my/questions"><ListGroupItem className="justify-content-between">あなた宛ての質問<QuestionRemaining/></ListGroupItem></Link>
                <Link to="/my/followers"><ListGroupItem className="justify-content-between">Quesdon を利用しているフォロワー一覧</ListGroupItem></Link>
                <Link to="/my/settings"><ListGroupItem className="justify-content-between">設定</ListGroupItem></Link>
                { me.isAdmin ? <Link to="/my/admin"><ListGroupItem className="justify-content-between">管理ページ</ListGroupItem></Link> : "" }
                { me.isAdmin ? <Link to="/my/reported"><ListGroupItem className="justify-content-between">通報された質問</ListGroupItem></Link> : "" }
            </ListGroup>
            <p></p>
            <ul>
                <li><a href="javascript://" onClick={this.logoutConfirm.bind(this)}>ログアウト</a></li>
            </ul>
        </div>
    }
    logoutConfirm() {
        if (!confirm("ログアウトしていい?")) return
        apiFetch("/api/web/logout")
            .then((r) => r.json())
            .then((r) => {
                location.pathname = "/"
            })
    }
}
