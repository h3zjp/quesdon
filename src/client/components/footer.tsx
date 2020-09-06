import * as React from "react"
import { Link } from "react-router-dom"
import { gitVersion, upstreamUrl, usingDarkTheme } from "../initial-state"

export class Footer extends React.Component {
    render() {
        return <footer className="container">
            <div className="data">
            <p>公式アカウント: <a href="https://mstdn.h3z.jp/@quesdon" target="_blank">@quesdon@mstdn.h3z.jp</a></p>
            <p>開発者: <a href="https://mstdn.maud.io/@rinsuki" target="_blank">@rinsuki@mstdn.maud.io</a></p>
            <p><a href="/@quesdon@mstdn.h3z.jp">公式Quesdon</a> (要望や不具合報告もこちらへどうぞ)</p>
            </div>
            <div className="logo">
                <p className="title">Quesdon</p>
                <p>AGPL-3.0&nbsp;<a target="_blank" href={upstreamUrl}>ソースコード</a>&nbsp;
                (<a target="_blank" href={`${upstreamUrl}/commits/${gitVersion}`}>{gitVersion.slice(0, 7)}</a>)</p>
            </div><br />
            <div className="darktheme">
                {usingDarkTheme
                ?   <button className="btn" onClick={this.leaveDarkTheme.bind(this)}>ダークテーマから戻す</button>
                :   <button className="btn" onClick={this.enterDarkTheme.bind(this)}>ダークテーマにする(β)</button>
                }
            </div>
        </footer>
    }

    leaveDarkTheme() {
        localStorage.removeItem("using-dark-theme")
        location.reload()
    }

    enterDarkTheme() {
        localStorage.setItem("using-dark-theme", "1")
        location.reload()
    }
}
