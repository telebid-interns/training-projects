function exportToExcel (event, tableID, reportName, filterNames, filterValues) {
  event.preventDefault();
  const uri = 'data:application/vnd.ms-excel;base64,';
  const template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>';

  const base64 = function(s) {
      return window.btoa(unescape(encodeURIComponent(s)))
  };

  const format = function(s, c) {
      return s.replace(/{(\w+)}/g, (m, p) => {
          return c[p];
      });
  };

  const filterTable = document.createElement('table');

  const filterHeaders = ['Filter', 'Value'];

  const thRow = document.createElement('tr');

  for (const header of filterHeaders) {
    const th = document.createElement('th');

    th.innerHTML = header;

    thRow.appendChild(th);
    filterTable.appendChild(thRow);
  }

  for (let i = 0; i < filterNames.length; i++) {
    const row = document.createElement('tr');
    const tdName = document.createElement('td');
    const tdVal = document.createElement('td');

    tdName.innerHTML = filterNames[i];
    tdVal.innerHTML = filterValues[i];

    row.appendChild(tdName);
    row.appendChild(tdVal);

    filterTable.appendChild(row);
  }

  let htmls = filterTable.innerHTML + document.getElementById(tableID).innerHTML;

  const ctx = {
      worksheet : 'Worksheet',
      table : htmls
  }

  const link = document.createElement("a");
  link.download = `${reportName}-report-${new Date().toISOString()}.xls`;
  link.href = uri + base64(format(template, ctx));
  link.click();
}
