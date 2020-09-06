import * as React from "react"
import { Link } from "react-router-dom"
import { me } from "../../initial-state"
import { PageLatest } from "./latest"

export class PageIndex extends React.Component {
    render() {
        return <div>
            <title>Quesdon</title>
            <h1>Quesdon</h1>
            <p>ザ･インタビューズとかaskfmとかそんなかんじのやつのMastodonアカウントで使えるやつです</p>
            <details>
                  <summary>2020/07/05更新： 動作不具合を修正しました</summary>
                <strong>
                    設定不備により、正常に動作しなくなっていたことを発見しました。
                    修正し、現在は正常に動作することを確認しております。
                    ご不便をお掛けし申し訳ありませんでした。
                    これからも、宜しくお願いいたします。
                </strong>
            </details>
            <details>
                  <summary>2020/09/06更新： Twitterサポートを復活しました</summary>
                <strong>
                    Twitterサポートを復活しました。
                    以前と変わらずにご利用頂けます。
                    これからも、宜しくお願いいたします。
                </strong>
            </details>
            <p>{me ? <Link to="/my">マイページ</Link> : <Link to="/login">ログイン</Link>}</p>
            <PageLatest />
        </div>
    }
}
