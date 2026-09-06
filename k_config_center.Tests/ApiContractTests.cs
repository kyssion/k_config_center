using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace k_config_center.Tests;

/// <summary>API 契约集成测试（WebApplicationFactory 内存宿主，不依赖真实数据库）：
/// 验证统一响应契约、参数校验转 10003、API Key 鉴权转 10004、探针健康检查的 HTTP 状态码语义</summary>
public class ApiContractTests : IDisposable
{
    private readonly WebApplicationFactory<Program> factory;

    public ApiContractTests()
    {
        factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            // Testing 环境：不加载 appsettings.Development.json（避免读到本机真实数据库连接），
            // 连接串指向必然拒绝连接的本机端口，让依赖数据库的路径确定性地失败
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:PostgreSQL", "Host=127.0.0.1;Port=1;Database=test;Username=test;Password=test");
        });
    }

    public void Dispose() => factory.Dispose();

    /// <summary>解析统一响应体的 code 字段</summary>
    private static async Task<int> ReadCodeAsync(HttpResponseMessage response)
    {
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("code").GetInt32();
    }

    [Fact]
    public async Task 活性探针_返回200Healthy()
    {
        var response = await factory.CreateClient().GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task 数据库探针_连不上时返回503()
    {
        // 探针语义靠 HTTP 状态码表达（区别于业务接口的错误码）：数据库不可达必须让编排器看到 503
        var response = await factory.CreateClient().GetAsync("/health/db");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
    }

    [Fact]
    public async Task 未知API路径_返回404而不是SPA兜底()
    {
        var response = await factory.CreateClient().GetAsync("/api/not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task 请求体缺必填字段_统一契约返回10003而非400()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/namespaces", new { });

        // 关闭 ApiController 自动 400 后，校验失败走 ModelValidationFilter → 统一契约（HTTP 200 + code）
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(10003, await ReadCodeAsync(response));
    }

    [Fact]
    public async Task 请求体违反长度校验_返回10003()
    {
        var body = new { namespaceKey = new string('a', 129), namespaceName = "超长key测试" };

        var response = await factory.CreateClient().PostAsJsonAsync("/api/namespaces", body);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(10003, await ReadCodeAsync(response));
    }

    [Fact]
    public async Task 启用鉴权_缺失XApiKey_返回10004()
    {
        var client = CreateClientWithAuth(enabled: true);

        var response = await client.GetAsync("/api/namespaces");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(10004, await ReadCodeAsync(response));
    }

    [Fact]
    public async Task 启用鉴权_错误XApiKey_返回10004()
    {
        var client = CreateClientWithAuth(enabled: true);
        client.DefaultRequestHeaders.Add("X-Api-Key", "wrong-key");

        var response = await client.GetAsync("/api/namespaces");

        Assert.Equal(10004, await ReadCodeAsync(response));
    }

    [Fact]
    public async Task 启用鉴权_正确XApiKey_通过鉴权到达业务层()
    {
        var client = CreateClientWithAuth(enabled: true);
        client.DefaultRequestHeaders.Add("X-Api-Key", "test-key");

        var response = await client.GetAsync("/api/namespaces");

        // 通过鉴权后到达业务层：测试宿主无真实数据库，返回 10000（证明已越过 10004 鉴权关卡）
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal(10000, await ReadCodeAsync(response));
    }

    [Fact]
    public async Task 启用鉴权_健康探针豁免()
    {
        var client = CreateClientWithAuth(enabled: true);

        var response = await client.GetAsync("/health/live");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    /// <summary>构造启用了 API Key 鉴权的测试客户端</summary>
    private HttpClient CreateClientWithAuth(bool enabled) =>
        factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Auth:Enabled", enabled.ToString().ToLowerInvariant());
            builder.UseSetting("Auth:ApiKey", "test-key");
        }).CreateClient();
}
