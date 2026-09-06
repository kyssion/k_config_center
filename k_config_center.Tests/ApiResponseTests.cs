using System.Text.Json;
using k_config_center.Infrastructure;
using Xunit;

namespace k_config_center.Tests;

/// <summary>统一响应结构与错误码单元测试：{ code, message, data } 契约形状</summary>
public class ApiResponseTests
{
    [Fact]
    public void Ok_携带数据时_契约形状正确()
    {
        var json = JsonSerializer.SerializeToElement(ApiResponse.Ok(42));

        Assert.Equal(0, json.GetProperty("code").GetInt32());
        Assert.Equal("success", json.GetProperty("message").GetString());
        Assert.Equal(42, json.GetProperty("data").GetInt32());
    }

    [Fact]
    public void Ok_无数据时_data为null()
    {
        var json = JsonSerializer.SerializeToElement(ApiResponse.Ok());

        Assert.Equal(0, json.GetProperty("code").GetInt32());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("data").ValueKind);
    }

    [Fact]
    public void Fail_携带错误码与消息()
    {
        var json = JsonSerializer.SerializeToElement(ApiResponse.Fail(ErrorCode.ResourceNotFound, "资源不存在"));

        Assert.Equal(10002, json.GetProperty("code").GetInt32());
        Assert.Equal("资源不存在", json.GetProperty("message").GetString());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("data").ValueKind);
    }
}
