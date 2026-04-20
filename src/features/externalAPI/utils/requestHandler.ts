import { getSubconsciousUrl, getUserInputUrl, getLogsUrl, getChatLogsUrl } from "@/features/externalAPI/externalAPI";

export const requestMemory = async () => {
  const response = await fetch(getSubconsciousUrl());
  return response.json();
};

export const requestLogs = async () => {
  const response = await fetch(getLogsUrl());
  return response.json();
};

export const requestUserInputMessages = async () => {
  const response = await fetch(getUserInputUrl());
  return response.json();
};

export const requestChatHistory = async () => {
  const response = await fetch(getChatLogsUrl());
  return response.json();
};