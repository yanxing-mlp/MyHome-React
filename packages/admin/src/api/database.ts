import type { AxiosRequestConfig } from 'axios';
import { get, post, put, toQuery } from '../lib/http';

/**
 * 「数据库」接口封装（方案 v52）：可视化浏览表 / 行内增删查改 / 结构化改表结构 / 跑任意 SQL / 每日备份 + 保留天数。
 * 类型与后端 DatabaseService 各方法返回的 JsonNode 逐字对应（见 controller/b/DatabaseController.java）。
 */

/** 表清单里的一张表。 */
export interface DbTable {
  name: string;
  /** information_schema 的行数估算（InnoDB 是近似值）。 */
  rows: number;
  comment: string;
}

/** GET /tables 返回。 */
export interface DbTableList {
  database: string;
  tables: DbTable[];
}

/** 一列的结构定义。 */
export interface DbColumn {
  name: string;
  type: string;
  nullable: boolean;
  /** SHOW FULL COLUMNS 的 Key 列：PRI / UNI / MUL / ''。 */
  key: string;
  defaultValue: string | null;
  extra: string;
  comment: string;
  primaryKey: boolean;
}

/** GET /table/columns 返回。 */
export interface DbColumns {
  table: string;
  columns: DbColumn[];
  primaryKeys: string[];
}

/** 一个索引（按 Key_name 聚合，columns 已按 Seq_in_index 排序；前缀索引标成 col(N)、函数索引为表达式）。 */
export interface DbIndex {
  name: string;
  /** Non_unique=0，即唯一索引（含主键）。 */
  unique: boolean;
  /** Index_type，通常 BTREE。 */
  type: string;
  /** 有序列名。 */
  columns: string[];
  /** Index_comment。 */
  comment: string;
  visible: boolean;
}

/** GET /table/indexes 返回。 */
export interface DbIndexes {
  table: string;
  indexes: DbIndex[];
}

/** 数据网格的列元信息（比结构页轻，只够渲染表格与定位主键）。 */
export interface DbDataColumn {
  name: string;
  type: string;
  primaryKey: boolean;
}

/** 一行数据：列名 → JSON 安全值（二进制转占位文本、时间转字符串）。 */
export type DbRow = Record<string, string | number | boolean | null>;

/** GET /table/data 返回。editable=false 表示该表无主键、不给行内改/删。 */
export interface DbTableData {
  table: string;
  page: number;
  size: number;
  editable: boolean;
  total: number;
  columns: DbDataColumn[];
  rows: DbRow[];
}

/** 结构化改表结构的操作。action=comment 改表级说明（无需 name/dataType）。 */
export interface DbAlterOp {
  action: 'add' | 'modify' | 'drop' | 'comment';
  name: string;
  /** add / modify 用；drop 忽略。 */
  dataType?: string;
  nullable?: boolean;
  defaultValue?: string | null;
  comment?: string;
  /** add 用：插到哪一列之后（空则追加到末尾）。 */
  after?: string;
}

/** SQL 结果：SELECT 类回结果集，写 / DDL 类回影响行数。 */
export interface DbSqlResult {
  sql: string;
  type: 'resultSet' | 'update';
  /** type=resultSet 时有值。 */
  columns?: { name: string; type: string }[];
  rows?: DbRow[];
  rowCount?: number;
  truncated?: boolean;
  /** type=update 时有值。 */
  updateCount?: number;
}

/** 一个备份文件。 */
export interface DbBackup {
  name: string;
  size: number;
  lastModified: number;
}

/** GET /backups 返回。available=false 表示当前环境未落日志文件、备份不可用（开发机）。 */
export interface DbBackupList {
  available: boolean;
  backupDir: string;
  retentionDays: number;
  backups: DbBackup[];
}

/** GET /settings 返回。 */
export interface DbSettings {
  retentionDays: number;
  available: boolean;
}

/** 列出当前库所有表。 */
export function fetchDbTables(config?: AxiosRequestConfig): Promise<DbTableList> {
  return get<DbTableList>('/api/b/database/tables', config);
}

/** 读一张表的结构。 */
export function fetchDbColumns(table: string, config?: AxiosRequestConfig): Promise<DbColumns> {
  return get<DbColumns>(`/api/b/database/table/columns${toQuery({ table })}`, config);
}

/** 读一张表的完整索引清单（按索引名聚合）。 */
export function fetchDbIndexes(table: string, config?: AxiosRequestConfig): Promise<DbIndexes> {
  return get<DbIndexes>(`/api/b/database/table/indexes${toQuery({ table })}`, config);
}

/** 分页读一张表的数据。 */
export function fetchDbTableData(
  table: string,
  page: number,
  size: number,
  config?: AxiosRequestConfig,
): Promise<DbTableData> {
  return get<DbTableData>(`/api/b/database/table/data${toQuery({ table, page, size })}`, config);
}

/** 新增一行。 */
export function insertDbRow(
  table: string,
  values: DbRow,
  config?: AxiosRequestConfig,
): Promise<{ affected: number }> {
  return post<{ affected: number }>('/api/b/database/table/row', { table, values }, config);
}

/** 改一行（pk 定位主键列 → 值）。 */
export function updateDbRow(
  table: string,
  pk: DbRow,
  values: DbRow,
  config?: AxiosRequestConfig,
): Promise<{ affected: number }> {
  return put<{ affected: number }>('/api/b/database/table/row', { table, pk, values }, config);
}

/** 删一行（POST 而非 DELETE，避免带 body 的 DELETE 被代理剥掉）。 */
export function deleteDbRow(
  table: string,
  pk: DbRow,
  config?: AxiosRequestConfig,
): Promise<{ affected: number }> {
  return post<{ affected: number }>('/api/b/database/table/row/delete', { table, pk }, config);
}

/** 结构化改表结构（加列 / 改列 / 删列）。 */
export function alterDbTable(
  table: string,
  op: DbAlterOp,
  config?: AxiosRequestConfig,
): Promise<{ ddl: string; affected: number }> {
  return post<{ ddl: string; affected: number }>('/api/b/database/table/alter', { table, op }, config);
}

/** 跑一条任意 SQL（全放开：读 + 写 + DDL）。 */
export function runDbSql(sql: string, config?: AxiosRequestConfig): Promise<DbSqlResult> {
  return post<DbSqlResult>('/api/b/database/sql', { sql }, config);
}

/** 备份文件列表 + 保留天数 + 是否可用。 */
export function fetchDbBackups(config?: AxiosRequestConfig): Promise<DbBackupList> {
  return get<DbBackupList>('/api/b/database/backups', config);
}

/** 立即备份一次（mysqldump 整库导出）。 */
export function backupDbNow(config?: AxiosRequestConfig): Promise<{ available: boolean; name: string; size: number; time: number }> {
  return post<{ available: boolean; name: string; size: number; time: number }>('/api/b/database/backup', {}, config);
}

/** 删除一个备份文件。 */
export function deleteDbBackup(name: string, config?: AxiosRequestConfig): Promise<{ deleted: boolean }> {
  return post<{ deleted: boolean }>('/api/b/database/backup/delete', { name }, config);
}

/** 读备份保留天数设置。 */
export function fetchDbSettings(config?: AxiosRequestConfig): Promise<DbSettings> {
  return get<DbSettings>('/api/b/database/settings', config);
}

/** 设置备份保留天数（1..365），持久化并立即清理旧备份。 */
export function saveDbSettings(retentionDays: number, config?: AxiosRequestConfig): Promise<DbSettings> {
  return put<DbSettings>('/api/b/database/settings', { retentionDays }, config);
}
