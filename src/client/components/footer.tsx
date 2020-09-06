import * as React from "react"
import { Link } from "react-router-dom"
import { gitVersion, upstreamUrl, usingDarkTheme } from "../initial-state"

export class Footer extends React.Component {
    render() {
        return <footer className="container">
            <p>Quesdon は AGPL-3.0 で提供されています。<a href={upstreamUrl}>ソースコード</a>&nbsp;
            (<a href={`${upstreamUrl}/commits/${gitVersion}`}>{gitVersion.slice(0, 7)}</a>)</p>
            <p>
                公式アカウント: <a href="https://mstdn.h3z.jp/@quesdon" target="_blank">@quesdon@mstdn.h3z.jp</a>
                &nbsp;
                <Link to="/@quesdon@mstdn.h3z.jp">公式Quesdon (要望や不具合報告もこちらへどうぞ)</Link>
            </p>
            <p>開発者: <a href="https://mstdn.maud.io/@rinsuki" target="_blank">@rinsuki@mstdn.maud.io</a></p>
            <p>
                {usingDarkTheme
                ?   <a href="#" onClick={this.leaveDarkTheme.bind(this)}>ダークテーマから戻す</a>
                :   <a href="#" onClick={this.enterDarkTheme.bind(this)}>ダークテーマにする(β)</a>
                }
            </p>
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
