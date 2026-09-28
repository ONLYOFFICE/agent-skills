builderJS.CreateFile("docx");

function addLine(doc, description, qty, price) {
  const line = Api.CreateParagraph();
  line.AddText(description + "  x" + qty + "  " + price);
  doc.Push(line);
}

const oDocument = Api.GetDocument();
const oHeading = oDocument.GetElement(0);
oHeading.AddText("Invoice {{ORDER_ID}}");

const oCustomer = Api.CreateParagraph();
oCustomer.AddText("Bill to: {{CUSTOMER}}");
oDocument.Push(oCustomer);

const oItems = Api.CreateParagraph();
oItems.AddText("Item  Qty  Price");
oDocument.Push(oItems);
{{ROWS}}

builderJS.SaveFile("pdf", "invoice.pdf");
builderJS.CloseFile();
