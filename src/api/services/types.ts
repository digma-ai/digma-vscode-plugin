export interface UserSession {
  accessToken: string;
  refreshToken: string;
  expiration: string;
  userId: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export type LoginResponse = UserSession;

export interface RefreshTokenPayload {
  accessToken: string;
  refreshToken: string;
}

export type RefreshTokenResponse = UserSession;

export enum InsightType {
  TopErrorFlows = "TopErrorFlows",
  HotSpot = "HotSpot",
  Errors = "Errors",
  SlowEndpoint = "SlowEndpoint",
  LowUsage = "LowUsage",
  NormalUsage = "NormalUsage",
  HighUsage = "HighUsage",
  EndpointBottleneck = "EndpointBottleneck",
  EndpointSpanNPlusOne = "EndpointSpanNPlusOne",
  SpanUsages = "SpanUsages",
  SpaNPlusOne = "SpaNPlusOne",
  SpanEndpointBottleneck = "SpanEndpointBottleneck",
  SpanDurations = "SpanDurations",
  SpanScaling = "SpanScaling",
  SpanDurationBreakdown = "SpanDurationBreakdown",
  EndpointBreakdown = "EndpointBreakdown",
  SpanScalingWell = "SpanScalingWell",
  SpanScalingInsufficientData = "SpanScalingInsufficientData",
  EndpointSessionInView = "EndpointSessionInView",
  EndpointChattyApiV2 = "EndpointChattyApiV2",
  EndpointHighNumberOfQueries = "EndpointHighNumberOfQueries",
  SpanNexus = "SpanNexus",
  SpanQueryOptimization = "SpanQueryOptimization",
  EndpointQueryOptimizationV2 = "EndpointQueryOptimizationV2",
  EndpointSlowdownSource = "EndpointSlowdownSource",
  SpanPerformanceAnomaly = "SpanPerformanceAnomaly",
  EndpointScaling = "EndpointScaling"
}

export interface IncidentIssue {
  issue_id: string;
  span_uid: string | null;
  type: string;
  issue_type: string;
  criticality: number;
}

export interface InsightIncidentIssue extends IncidentIssue {
  type: "issue";
  issue_type: InsightType;
}

export interface ErrorIncidentIssue extends IncidentIssue {
  type: "error";
}

export type GenericIncidentIssue = InsightIncidentIssue | ErrorIncidentIssue;

export type IncidentStatus =
  | "active"
  | "pending"
  | "closed"
  | "error"
  | "canceled";

export type ArtifactType = "pr" | "issue";

export interface IncidentArtifact {
  id: number;
  url: string;
  type: ArtifactType;
  display_name: string;
}

export interface ErrorStatusInfo {
  error: {
    message: string;
    stack_trace: string | null;
    exception_type: string | null;
  };
}

export interface StatusData {
  timestamp: string;
  status_info: ErrorStatusInfo | null;
}

export interface GetIncidentPayload {
  id: string;
}

export interface GetIncidentResponse {
  id: string;
  name: string;
  description: string;
  summary: string;
  status: IncidentStatus;
  related_issues: GenericIncidentIssue[];
  related_artifacts: IncidentArtifact[];
  affected_services: string[];
  status_details: Partial<Record<IncidentStatus, StatusData>>;
}
