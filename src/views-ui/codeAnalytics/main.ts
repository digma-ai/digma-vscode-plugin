import { integer } from "vscode-languageclient";
import { vscode, consume, publish } from "../common/contracts";
import { CodeObjectChanged, DismissErrorFlow } from "./contracts";

$(document).on('click', '#bbb', () =>
{
    publish(new DismissErrorFlow('111'));
});

consume(CodeObjectChanged, m => {
    console.log(m.codeObjectId);
})