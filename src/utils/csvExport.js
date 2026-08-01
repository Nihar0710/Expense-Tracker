import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const HEADERS = ['Date', 'Type', 'Amount', 'Category', 'Payee', 'UPI ID', 'Note', 'Status'];

function escape(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  // Wrap in quotes if the value contains a comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function exportTransactionsCSV(transactions) {
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions to export.');
  }

  const rows = [
    HEADERS.join(','),
    ...transactions.map((t) =>
      [
        escape(new Date(t.created_at).toLocaleString()),
        escape(t.type),
        escape(Number(t.amount).toFixed(2)),
        escape(t.category),
        escape(t.payee_name),
        escape(t.upi_id),
        escape(t.note),
        escape(t.status),
      ].join(',')
    ),
  ];

  const csv = rows.join('\n');
  const filename = `transactions_${Date.now()}.csv`;
  const path = `${FileSystem.documentDirectory}${filename}`;

  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) throw new Error('Sharing is not available on this device.');

  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'Export transactions',
    UTI: 'public.comma-separated-values-text',
  });
}
