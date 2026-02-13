import React, { useState, useEffect, useCallback } from 'react';
import { VisualizationLearningSystem } from '../utils/visualization-learning-system';
import {
  VisualizationType,
  VisualizationFeedback,
  UserProfile,
  VisualizationPreference,
  UserInteractionMetrics
} from '../types/visualization-learning';

interface LearningMonitorProps {
  learningSystem: VisualizationLearningSystem;
}

interface UserStats {
  totalInteractions: number;
  averageTimeSpent: number;
  totalExports: number;
  totalModifications: number;
  preferredVisualization: VisualizationType;
  highestConfidence: number;
}

export const LearningMonitor: React.FC<LearningMonitorProps> = ({ learningSystem }) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userList, setUserList] = useState<string[]>([]);
  const [userStats, setUserStats] = useState<Map<string, UserStats>>(new Map());
  const [feedbackHistory, setFeedbackHistory] = useState<VisualizationFeedback[]>([]);
  const [preferences, setPreferences] = useState<Map<VisualizationType, VisualizationPreference>>(new Map());
  const [systemStats, setSystemStats] = useState<{
    totalUsers: number;
    totalFeedback: number;
    averageConfidence: number;
  }>({ totalUsers: 0, totalFeedback: 0, averageConfidence: 0 });

  const refreshData = useCallback(() => {
    // Get data from learning system
    const users = learningSystem.getUserList();
    setUserList(users);
    setSystemStats(learningSystem.getSystemStats());

    // Calculate stats for each user
    const stats = new Map<string, UserStats>();
    users.forEach((userId: string) => {
      const userFeedback = learningSystem.getUserFeedback(userId);
      const userProfile = learningSystem.getUserProfile(userId);

      if (userFeedback && userProfile) {
        const totalInteractions = userFeedback.reduce(
          (sum: number, f: VisualizationFeedback) => sum + f.interactionMetrics.interactionCount,
          0
        );
        const totalTimeSpent = userFeedback.reduce(
          (sum: number, f: VisualizationFeedback) => sum + f.interactionMetrics.timeSpent,
          0
        );
        const totalExports = userFeedback.reduce(
          (sum: number, f: VisualizationFeedback) => sum + f.interactionMetrics.exportCount,
          0
        );
        const totalModifications = userFeedback.reduce(
          (sum: number, f: VisualizationFeedback) => sum + f.interactionMetrics.modificationCount,
          0
        );

        // Find preferred visualization type
        let preferredType: VisualizationType = 'single-layer';
        let highestScore = 0;
        userProfile.visualizationPreferences.forEach((pref, type) => {
          if (pref.score > highestScore) {
            highestScore = pref.score;
            preferredType = type;
          }
        });

        stats.set(userId, {
          totalInteractions,
          averageTimeSpent: totalTimeSpent / userFeedback.length,
          totalExports,
          totalModifications,
          preferredVisualization: preferredType,
          highestConfidence: highestScore
        });
      }
    });
    setUserStats(stats);

    // Update selected user data
    if (selectedUser) {
      setFeedbackHistory(learningSystem.getUserFeedback(selectedUser) || []);
      const userProfile = learningSystem.getUserProfile(selectedUser);
      if (userProfile) {
        setPreferences(userProfile.visualizationPreferences);
      }
    }
  }, [learningSystem, selectedUser]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (timestamp: string): string => {
    return new Date(timestamp).toISOString();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Visualization Learning Monitor</h1>

      {/* System Stats */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">System Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded shadow">
            <h3 className="font-semibold">Total Users</h3>
            <p className="text-2xl">{systemStats.totalUsers}</p>
          </div>
          <div className="p-4 border rounded shadow">
            <h3 className="font-semibold">Total Feedback</h3>
            <p className="text-2xl">{systemStats.totalFeedback}</p>
          </div>
          <div className="p-4 border rounded shadow">
            <h3 className="font-semibold">Average Confidence</h3>
            <p className="text-2xl">{(systemStats.averageConfidence * 100).toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* User Selection */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Users</h2>
        <div className="flex flex-wrap gap-2">
          {userList.map(userId => (
            <button
              key={userId}
              onClick={() => setSelectedUser(userId)}
              className={`px-4 py-2 rounded ${
                selectedUser === userId
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              {userId}
            </button>
          ))}
        </div>
      </div>

      {/* Overall Statistics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Overall Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from(userStats.entries()).map(([userId, stats]) => (
            <div
              key={userId}
              className="p-4 border rounded shadow hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold mb-2">User: {userId}</h3>
              <ul className="space-y-1 text-sm">
                <li>Total Interactions: {stats.totalInteractions}</li>
                <li>Avg Time Spent: {formatTime(stats.averageTimeSpent)}</li>
                <li>Total Exports: {stats.totalExports}</li>
                <li>Total Modifications: {stats.totalModifications}</li>
                <li>Preferred Viz: {stats.preferredVisualization}</li>
                <li>Highest Confidence: {(stats.highestConfidence * 100).toFixed(1)}%</li>
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Selected User Details */}
      {selectedUser && (
        <>
          {/* Visualization Preferences */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Visualization Preferences for {selectedUser}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(preferences.entries()).map(([type, pref]) => (
                <div
                  key={type}
                  className="p-4 border rounded shadow hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold mb-2">{type}</h3>
                  <ul className="space-y-1 text-sm">
                    <li>Score: {(pref.score * 100).toFixed(1)}%</li>
                    <li>Confidence: {(pref.confidence * 100).toFixed(1)}%</li>
                    <li>Evidence Count: {pref.supportingEvidence?.length || 0}</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback History */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">
              Feedback History for {selectedUser}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="p-2 border">Timestamp</th>
                    <th className="p-2 border">Type</th>
                    <th className="p-2 border">Source</th>
                    <th className="p-2 border">Rating</th>
                    <th className="p-2 border">Interactions</th>
                    <th className="p-2 border">Time Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackHistory.map((feedback, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="p-2 border">{formatDate(feedback.timestamp.toISOString())}</td>
                      <td className="p-2 border">{feedback.visualizationType}</td>
                      <td className="p-2 border">{feedback.source}</td>
                      <td className="p-2 border">
                        {feedback.explicitRating !== undefined
                          ? `${(feedback.explicitRating * 100).toFixed(1)}%`
                          : 'N/A'}
                      </td>
                      <td className="p-2 border">{feedback.interactionMetrics.interactionCount}</td>
                      <td className="p-2 border">
                        {formatTime(feedback.interactionMetrics.timeSpent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 