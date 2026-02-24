package module

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	pb "github.com/GalitskyKK/nekkus-core/pkg/protocol"
	"github.com/GalitskyKK/nekkus-eye/internal/monitor"
	"google.golang.org/grpc"
)

// EyeModule реализует NekkusModule для System Monitor.
type EyeModule struct {
	pb.UnimplementedNekkusModuleServer
	collector *monitor.Collector
	httpPort  int
}

// New создаёт EyeModule.
func New(collector *monitor.Collector, httpPort int) *EyeModule {
	if httpPort <= 0 {
		httpPort = 9002
	}
	return &EyeModule{collector: collector, httpPort: httpPort}
}

func (m *EyeModule) GetInfo(ctx context.Context, _ *pb.Empty) (*pb.ModuleInfo, error) {
	return &pb.ModuleInfo{
		Id:           "eye",
		Name:         "Nekkus Eye",
		Version:      "0.1.0",
		Description:  "System monitor: CPU, memory, processes",
		Color:        "#10B981",
		HttpPort:     int32(m.httpPort),
		GrpcPort:     19002,
		UiUrl:        fmt.Sprintf("http://127.0.0.1:%d", m.httpPort),
		Capabilities: []string{"monitor.cpu", "monitor.memory", "monitor.stats"},
		Provides:     []string{"monitor.stats", "monitor.cpu", "monitor.memory"},
		Status:       pb.ModuleStatus_MODULE_RUNNING,
	}, nil
}

func (m *EyeModule) Health(ctx context.Context, _ *pb.Empty) (*pb.HealthStatus, error) {
	s := m.collector.Get()
	return &pb.HealthStatus{
		Healthy: true,
		Message: "ok",
		Details: map[string]string{
			"cpu_percent":    fmt.Sprintf("%.1f", s.CPUPercent),
			"memory_percent": fmt.Sprintf("%.1f", s.MemoryPercent),
		},
	}, nil
}

func (m *EyeModule) GetWidgets(ctx context.Context, _ *pb.Empty) (*pb.WidgetList, error) {
	return &pb.WidgetList{
		Widgets: []*pb.Widget{
			{
				Id:                "eye.stats",
				Title:             "System",
				Size:              pb.WidgetSize_WIDGET_SMALL,
				DataEndpoint:      "/api/stats",
				RefreshIntervalMs: 2000,
			},
			{
				Id:                "eye.cpu",
				Title:             "CPU",
				Size:              pb.WidgetSize_WIDGET_MEDIUM,
				DataEndpoint:      "/api/stats",
				RefreshIntervalMs: 1000,
			},
			{
				Id:                "eye.memory",
				Title:             "Memory",
				Size:              pb.WidgetSize_WIDGET_MEDIUM,
				DataEndpoint:      "/api/stats",
				RefreshIntervalMs: 1000,
			},
		},
	}, nil
}

func (m *EyeModule) GetActions(ctx context.Context, _ *pb.Empty) (*pb.ActionList, error) {
	return &pb.ActionList{
		Actions: []*pb.Action{
			{
				Id:          "eye.refresh",
				Label:       "Refresh",
				Description: "Refresh system stats",
				Icon:        "🔄",
				ModuleId:    "eye",
				Tags:        []string{"monitor", "refresh"},
			},
			{
				Id:          "disconnect",
				Label:       "Stop module",
				Description: "Stop Nekkus Eye (from Hub)",
				Icon:        "⏹",
				ModuleId:    "eye",
				Tags:        []string{"hub", "stop"},
			},
		},
	}, nil
}

func (m *EyeModule) StreamData(req *pb.StreamRequest, _ grpc.ServerStreamingServer[pb.DataEvent]) error {
	return nil
}

func (m *EyeModule) Execute(ctx context.Context, req *pb.ExecuteRequest) (*pb.ExecuteResponse, error) {
	switch req.ActionId {
	case "disconnect":
		return &pb.ExecuteResponse{Success: true, Message: "Stopped"}, nil
	case "eye.refresh":
		// Коллектор уже обновляется по таймеру; для Hub достаточно success
		return &pb.ExecuteResponse{Success: true, Message: "Refreshed"}, nil
	}
	return &pb.ExecuteResponse{Success: false, Error: "unknown action"}, nil
}

func (m *EyeModule) Query(ctx context.Context, req *pb.QueryRequest) (*pb.QueryResponse, error) {
	switch req.QueryType {
	case "stats":
		s := m.collector.Get()
		data, _ := json.Marshal(s)
		return &pb.QueryResponse{Success: true, Data: data}, nil
	}
	return &pb.QueryResponse{Success: false, Error: "unknown query"}, nil
}

func (m *EyeModule) GetSnapshot(ctx context.Context, _ *pb.Empty) (*pb.StateSnapshot, error) {
	s := m.collector.Get()
	data, _ := json.Marshal(s)
	return &pb.StateSnapshot{
		ModuleId:  "eye",
		Timestamp: time.Now().Unix(),
		State:     data,
	}, nil
}

func (m *EyeModule) RestoreSnapshot(ctx context.Context, _ *pb.StateSnapshot) (*pb.RestoreResult, error) {
	return &pb.RestoreResult{Success: true, Message: "Restored"}, nil
}
