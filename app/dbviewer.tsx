import { getDb } from "@/utils/sqliteHelper";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────

type TableInfo = {
  name: string;
  rowCount: number;
};

type RowRecord = Record<string, unknown>;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DbViewerScreen() {
  const [loading, setLoading] = useState(false);
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [rows, setRows] = useState<RowRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadRows = async (tableName: string) => {
    try {
      setError(null);
      const database = await getDb();
      const tableRows = await database.getAllAsync<RowRecord>(
        `SELECT * FROM "${tableName}" LIMIT 50`,
      );
      setRows(tableRows);
    } catch (err: any) {
      setError(err?.message ?? `Failed to load rows from ${tableName}.`);
      setRows([]);
    }
  };

  const loadTables = async () => {
    try {
      setLoading(true);
      setError(null);

      const database = await getDb();
      const tableRows = await database.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
         ORDER BY name`,
      );

      const withCounts = await Promise.all(
        tableRows.map(async ({ name }) => {
          const countRow = await database.getFirstAsync<{ rowCount: number }>(
            `SELECT COUNT(*) AS rowCount FROM "${name}"`,
          );
          return { name, rowCount: countRow?.rowCount ?? 0 };
        }),
      );

      setTables(withCounts);

      if (withCounts.length === 0) {
        setSelectedTable(null);
        setRows([]);
      } else {
        const tableToSelect =
          selectedTable && withCounts.some((t) => t.name === selectedTable)
            ? selectedTable
            : withCounts[0].name;

        setSelectedTable(tableToSelect);
        await loadRows(tableToSelect);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load database tables.");
      setTables([]);
      setRows([]);
      setSelectedTable(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    await loadRows(tableName);
  };

  useEffect(() => {
    loadTables();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-4 pb-10 gap-2">

        <Text className="text-2xl font-bold text-text mb-1">Database Viewer</Text>

        <Pressable
          className="self-start border border-border rounded-lg py-2 px-4 active:opacity-50"
          onPress={loadTables}
        >
          <Text className="text-text font-semibold">Refresh</Text>
        </Pressable>

        {loading && <ActivityIndicator className="my-3" />}

        {!!error && (
          <Text className="text-danger mt-2">{error}</Text>
        )}

        {!loading && tables.length === 0 && !error && (
          <Text className="text-textSecondary italic mt-2">No tables found.</Text>
        )}

        {!loading && tables.length > 0 && (
          <View className="mt-4 gap-2">
            <Text className="text-base font-bold text-text mb-1">Tables</Text>
            {tables.map((table) => (
              <Pressable
                key={table.name}
                className={`border rounded-lg py-2 px-3 active:opacity-60 ${
                  selectedTable === table.name
                    ? "border-primary border-2 bg-surface"
                    : "border-border"
                }`}
                onPress={() => handleSelectTable(table.name)}
              >
                <Text className={`font-medium text-text ${selectedTable === table.name ? "text-primary" : ""}`}>
                  {table.name} ({table.rowCount})
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {selectedTable && (
          <View className="mt-4 gap-2">
            <Text className="text-base font-bold text-text mb-1">
              {selectedTable} — up to 50 rows
            </Text>
            {rows.length === 0 ? (
              <Text className="text-textSecondary italic">No rows in this table.</Text>
            ) : (
              rows.map((row, index) => (
                <View
                  key={`${selectedTable}-${index}`}
                  className="border border-border rounded-lg p-3 gap-1 bg-surface"
                >
                  <Text className="text-xs font-bold text-textSecondary">Row {index + 1}</Text>
                  <Text className="font-mono text-xs text-text">
                    {JSON.stringify(row, null, 2)}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
