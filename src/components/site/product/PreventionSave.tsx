"use client";

import { useState } from "react";
import { DrawerHeadView, DrawerSignalsView, DrawerSuccess, FixSectionView, MessagePreviewView, type DrawerOrder, type DrawerSignal } from "../drawer";

// Lena Hoffmann's order on the demo store (records/prevention.json) in the app's prevention drawer, with the recorded
// fix replayed: before the German reply the drawer shows risk 84 and its two signals; after it, the app's own
// confirmation and no signals left. Beside it, "Fix it now" with the reply as drafted, and Show English working as in
// the app. The Before / After switch is the page's, not the app's, so it sits under the drawer.

type Props = {
  order: DrawerOrder;
  signals: DrawerSignal[];
  fix: { detail: string; subject: string; body: string };
  english: { subject: string; body: string };
  saved: number;
};

export function PreventionSave({ order, signals, fix, english, saved }: Props) {
  const [after, setAfter] = useState(false);
  const [en, setEn] = useState(false);
  return (
    <div className="s-pr-save">
      <div className="s-pr-save__col">
        <div data-ui className="s-ui s-ui-sheet s-pr-risk" role="group" aria-label={`Prevention drawer for order ${order.orderId}, ${after ? "after the reply: prevented" : `before the reply: risk ${order.score} of 100`}`}>
          <div className="s-f-dr">
            <DrawerHeadView order={order} prevented={after} />
            {after ? <DrawerSuccess saved={saved} fee={order.fee} /> : null}
            <DrawerSignalsView signals={after ? [] : signals} />
          </div>
        </div>
        <div className="s-pr-risk__toggle" role="group" aria-label="Show the order before or after the reply">
          <button type="button" aria-pressed={!after} onClick={() => setAfter(false)}>
            Before the reply
          </button>
          <button type="button" aria-pressed={after} onClick={() => setAfter(true)}>
            After the reply
          </button>
        </div>
      </div>

      <div data-ui className="s-ui s-ui-sheet s-pr-reply" role="group" aria-label="Fix it now: the reply Exhibit drafted, in German">
        <div className="s-f-dr">
          <FixSectionView detail={fix.detail} label="Message buyer" channel="inbox" top>
            <MessagePreviewView language="German" subject={en ? english.subject : fix.subject} body={en ? english.body : fix.body} english={en} onEnglish={() => setEn((v) => !v)} />
          </FixSectionView>
        </div>
      </div>
    </div>
  );
}
