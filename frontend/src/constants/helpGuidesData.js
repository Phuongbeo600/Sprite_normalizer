// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// (File dữ liệu hằng số thuần túy, không import React)

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không có phụ thuộc bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// (Không áp dụng cho file hằng số)

/**
 * CẤU TRÚC ĐA HÌNH CHO NỘI DUNG HƯỚNG DẪN (Polymorphic Content Block Architecture).
 * Mỗi bài hướng dẫn chứa một mảng các khối nội dung (`blocks`).
 * Từng khối được định danh bởi thuộc tính `type`:
 * - 'paragraph': Đoạn văn bản mô tả, hỗ trợ định dạng in đậm và đánh dấu.
 * - 'steps': Danh sách các bước thao tác cụ thể, có số thứ tự và hướng dẫn.
 * - 'callout': Hộp ghi chú / cảnh báo / mẹo nổi bật ('tip' | 'info' | 'warning').
 * - 'code': Khối hiển thị mã nguồn (GDScript, Python, SQL) kèm nút sao chép.
 * - 'faq': Danh sách các câu hỏi thường gặp (Q&A) tương tác đóng/mở.
 * - 'table': Bảng so sánh thông số, thuộc tính kỹ thuật.
 * - 'preview': Khối xem trước trực quan thông số hoặc kết quả mô phỏng.
 */

/**
 * Danh sách toàn bộ các khu vực và bài viết hướng dẫn chi tiết của Sprite AI.
 */
export const HELP_GUIDE_CATEGORIES = [
  {
    id: 'getting-started',
    title: 'Bắt đầu',
    description: 'Các khái niệm nền tảng, đăng nhập tài khoản và tạo dự án đầu tiên.',
    iconName: 'Sparkles',
    articles: [
      {
        id: 'concepts',
        title: 'Các khái niệm cơ bản về Sprite & Pixel Art',
        summary: 'Hiểu về Bounding Box, Sprite Sheet, Frame hoạt họa và Điểm neo chân.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Chào mừng bạn đến với **Sprite AI Studio** – nền tảng tự động hóa xử lý, đo lường giải phẫu và chuẩn hóa đồ họa pixel dành cho các nhà phát triển game indie.'
          },
          {
            type: 'callout',
            level: 'info',
            title: 'Khái niệm cốt lõi',
            content: 'Một Sprite Sheet thường chứa nhiều khung hình (frames) của nhân vật được xếp cạnh nhau. Để nhân vật không bị rung lắc khi di chuyển trong game, tâm chân (Origin) của mọi frame phải thẳng hàng trên trục tọa độ.'
          },
          {
            type: 'steps',
            title: 'Quy trình chuẩn hóa 4 bước trong ứng dụng:',
            items: [
              {
                step: 1,
                title: 'Khởi tạo Dự án & Nhập API Key',
                desc: 'Tạo dự án riêng để lưu cấu hình khóa Gemini hoặc OpenAI trong MySQL.'
              },
              {
                step: 2,
                title: 'Phân tích mẫu & Sinh Prompt chuẩn',
                desc: 'Studio phân tích tỉ lệ đầu/thân, bảng màu và sinh ma trận prompt 15 frame.'
              },
              {
                step: 3,
                title: 'Tạo ảnh AI & Xử lý cắt ô',
                desc: 'Sinh ảnh Sprite Sheet bằng AI, sau đó cắt viền Bounding Box tự động.'
              },
              {
                step: 4,
                title: 'Kiểm thử Godot & Xuất tài nguyên',
                desc: 'Xem nhân vật chạy nhảy thử trên nền map và xuất file SpriteFrames cho Godot 4.'
              }
            ]
          },
          {
            type: 'faq',
            title: 'Câu hỏi thường gặp về chuẩn Pixel Art',
            items: [
              {
                q: 'Tại sao nhân vật thường bị giật hình khi đưa vào game engine?',
                a: 'Hiện tượng này xảy ra do kích thước bounding box giữa các frame không đều nhau, hoặc điểm neo chân (Origin 0,0) đặt sai vị trí trung tâm.'
              },
              {
                q: 'Kích thước chuẩn nào tối ưu nhất cho game Pixel?',
                a: 'Các kích thước phổ biến gồm 16x16, 32x32, 48x48 và 64x64 pixel. Hệ thống tự động căn chỉnh tỉ lệ chuẩn xác theo bội số.'
              }
            ]
          }
        ]
      },
      {
        id: 'auth-accounts',
        title: 'Đăng ký, Đăng nhập & Tài khoản kiểm thử',
        summary: 'Hướng dẫn sử dụng tài khoản Origin kiểm thử và quản trị Admin.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Hệ thống hỗ trợ 3 phân quyền tài khoản: **Người dùng cá nhân (User)**, **Tài khoản kiểm thử (Origin)** và **Quản trị viên (Admin)**.'
          },
          {
            type: 'callout',
            level: 'tip',
            title: 'Mẹo kiểm thử nhanh (Không cần tạo tài khoản)',
            content: 'Khi bạn chạy dự án lên, hệ thống sẽ **tự động đăng nhập sẵn vào tài khoản origin@gmail.com** (User ID: 2). Tài khoản này được bảo vệ vĩnh viễn và không thể bị xóa.'
          },
          {
            type: 'table',
            title: 'Bảng đối chiếu quyền hạn tài khoản:',
            headers: ['Loại tài khoản', 'Tên đăng nhập', 'Mật khẩu', 'Quyền hạn chính'],
            rows: [
              ['Quản trị viên (Admin)', 'admin', '1', 'Toàn quyền xem danh sách người dùng, theo dõi số dự án và xóa tài khoản vi phạm.'],
              ['Tài khoản Kiểm thử', 'origin@gmail.com', '123456', 'Sở hữu sẵn dự án mẫu ID = 2, đầy đủ sprite, 15 frame và đội hình Godot.'],
              ['Người dùng mới', 'email@gmail.com', '(Tự đặt)', 'Tạo dự án độc lập, lưu API Key riêng và quản lý kho sprite cá nhân.']
            ]
          },
          {
            type: 'steps',
            title: 'Các bước đăng ký tài khoản mới:',
            items: [
              {
                step: 1,
                title: 'Nhập Họ, Tên đệm và Tên',
                desc: 'Điền tên thật để hiển thị trên danh thiếp tài khoản ở góc dưới Sidebar.'
              },
              {
                step: 2,
                title: 'Nhập Tên tài khoản định dạng Gmail',
                desc: 'Bắt buộc phải có đuôi @gmail.com hợp lệ. Hệ thống sẽ báo đỏ nếu nhập sai cú pháp.'
              },
              {
                step: 3,
                title: 'Nhập mật khẩu và bấm "Tạo Tài Khoản Mới"',
                desc: 'Hệ thống sẽ tạo tài khoản và tự động đăng nhập vào giao diện Studio.'
              }
            ]
          }
        ]
      },
      {
        id: 'manage-projects',
        title: 'Quản lý Dự án & Cấu trúc Dữ liệu MySQL',
        summary: 'Cách tạo dự án mới, lưu khóa API độc lập và dọn dẹp dự án cũ.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Mọi tài nguyên trong Sprite AI Studio đều được phân vùng theo từng **Dự án riêng biệt**. Điều này giúp bạn có thể làm đồng thời nhiều tựa game với phong cách đồ họa khác nhau.'
          },
          {
            type: 'callout',
            level: 'warning',
            title: 'Lưu ý khi xóa dự án',
            content: 'Khi xóa một dự án, toàn bộ dữ liệu phụ thuộc gồm ảnh Sprite, 15 Frame hoạt họa, map nền và preset giải phẫu sẽ bị xóa sạch khỏi MySQL để tránh rác cơ sở dữ liệu.'
          },
          {
            type: 'steps',
            title: 'Cách khởi tạo dự án mới:',
            items: [
              {
                step: 1,
                title: 'Bấm nút "+ Tạo dự án"',
                desc: 'Nút màu tím nằm ở góc trên màn hình "Dự án của tôi".'
              },
              {
                step: 2,
                title: 'Đặt tên cho dự án',
                desc: 'Ví dụ: "Game Hiệp Sĩ Gothic", "Nông Trại Pixel"...'
              },
              {
                step: 3,
                title: 'Vào "Cài đặt dự án" để dán API Key',
                desc: 'Cấu hình Gemini hoặc OpenAI một lần duy nhất, key sẽ được lưu bảo mật trong MySQL.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'analysis-prompt',
    title: 'Phân tích & Prompt Studio',
    description: 'Bóc tách giải phẫu nhân vật, bảng màu và sinh ma trận 15 Frame hoạt họa.',
    iconName: 'ScanSearch',
    articles: [
      {
        id: 'anatomy-metrics',
        title: 'Giải phẫu nhân vật & Đo lường Pixel',
        summary: 'Tính toán tỷ lệ đầu/thân, chiều cao và bảng màu cơ bản.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Module **Phân tích & Prompt (Studio)** sử dụng thuật toán thị giác máy tính OpenCV để quét qua ảnh mẫu nhân vật, trích xuất các chỉ số giải phẫu hình học quan trọng.'
          },
          {
            type: 'table',
            title: 'Các chỉ số giải phẫu chính:',
            headers: ['Chỉ số', 'Ý nghĩa', 'Giá trị khuyến nghị cho Pixel Art'],
            rows: [
              ['Head-to-Body Ratio', 'Tỷ lệ giữa chiều cao đầu và toàn thân', '1:2 (Chibi), 1:3 (Mini Retro), 1:5 (Realistic)'],
              ['Canvas Padding', 'Khoảng đệm an toàn từ mép ảnh tới nhân vật', 'Từ 2px đến 4px mỗi cạnh'],
              ['Color Palette', 'Bảng màu chính trích xuất từ trang phục', 'Tối ưu từ 4 đến 16 màu để giữ chất Retro'],
              ['Base Height', 'Chiều cao tính từ đỉnh đầu đến gót chân', '32px, 48px hoặc 64px']
            ]
          },
          {
            type: 'callout',
            level: 'tip',
            title: 'Bật/Tắt chế độ AI thông minh',
            content: 'Nếu dự án của bạn tắt tính năng AI, bạn vẫn có thể nhập các chỉ số giải phẫu bằng tay và bấm "Lưu vào kho tài nguyên" bình thường.'
          }
        ]
      },
      {
        id: 'matrix-15-frames',
        title: 'Ma trận hoạt họa 15 khung hình (Action Matrix)',
        summary: 'Tạo prompt chuẩn hóa cho 5 hành động: Idle, Walk, Attack, Hurt, Die.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Hệ thống chuẩn hóa animation thành **ma trận 15 khung hình chuẩn**: 5 trạng thái hành động, mỗi trạng thái gồm 3 frame nối tiếp nhau.'
          },
          {
            type: 'steps',
            title: '5 Hành động chuẩn hóa trong ma trận:',
            items: [
              { step: 1, title: 'Đứng thở (Idle - 3 frames)', desc: 'Frame 1 (Bắt đầu) -> Frame 2 (Hạ trọng tâm) -> Frame 3 (Nâng lên lặp lại).' },
              { step: 2, title: 'Bước đi (Walk - 3 frames)', desc: 'Frame 1 (Bước chân phải) -> Frame 2 (Thu chân giữa) -> Frame 3 (Bước chân trái).' },
              { step: 3, title: 'Tấn công (Attack - 3 frames)', desc: 'Frame 1 (Lấy đà vung vũ khí) -> Frame 2 (Chém tối đa) -> Frame 3 (Thu chiêu).' },
              { step: 4, title: 'Trúng đòn (Hurt - 3 frames)', desc: 'Frame 1 (Giật lùi về sau) -> Frame 2 (Chớp đỏ chấn thương) -> Frame 3 (Ổn định lại).' },
              { step: 5, title: 'Gục ngã (Die - 3 frames)', desc: 'Frame 1 (Khuỵu gối) -> Frame 2 (Ngã chạm đất) -> Frame 3 (Nằm im hoàn tất).' }
            ]
          },
          {
            type: 'callout',
            level: 'info',
            title: 'Chuyển đổi ngôn ngữ Song ngữ Anh - Việt',
            content: 'Mỗi ô prompt trong ma trận đều có nút chuyển ngữ trực tiếp. Bạn có thể xem mô tả bằng tiếng Việt để dễ hình dung, và hệ thống sẽ tự động dùng prompt tiếng Anh khi gửi tới AI sinh ảnh.'
          }
        ]
      }
    ]
  },
  {
    id: 'image-generation',
    title: 'Tạo ảnh AI Sprite Sheet',
    description: 'Sinh chuỗi khung hình pixel bằng Google Gemini Imagen 3 hoặc OpenAI.',
    iconName: 'Sparkles',
    articles: [
      {
        id: 'ai-providers',
        title: 'Cấu hình & Sử dụng Google Gemini / OpenAI',
        summary: 'Cách lấy key miễn phí và tối ưu prompt để AI vẽ sprite đồng bộ.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Màn hình **Tạo ảnh AI** cho phép bạn biến các mô tả giải phẫu thành ảnh Sprite Sheet chân thực chỉ trong vài giây.'
          },
          {
            type: 'callout',
            level: 'tip',
            title: 'Đề xuất nhà cung cấp miễn phí',
            content: 'Google Gemini (Imagen 3) hoàn toàn miễn phí khi đăng ký qua Google AI Studio, có tốc độ sinh ảnh cực nhanh và hỗ trợ tái hiện phong cách Pixel Art rất tốt.'
          },
          {
            type: 'code',
            language: 'bash',
            title: 'Ví dụ cấu trúc prompt AI tối ưu cho Pixel Art:',
            code: 'pixel art sprite sheet of a dark gothic knight, 16-bit retro style, side view walking animation, clean transparent background, flat colors, no anti-aliasing, sharp edges, game asset'
          },
          {
            type: 'steps',
            title: 'Chuyển tiếp ảnh sau khi sinh xong:',
            items: [
              {
                step: 1,
                title: 'Chuyển sang Xử lý ảnh',
                desc: 'Bấm nút "Chuyển sang Cắt & Chuẩn Hóa" để thuật toán phân tách từng frame.'
              },
              {
                step: 2,
                title: 'Chuyển sang Thử nghiệm Godot',
                desc: 'Bấm nút "Thử nghiệm trong Godot" để chạy thử ngay trên sàn đất pixel.'
              }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'sprite-processing',
    title: 'Xử lý ảnh & Chuẩn hóa',
    description: 'Thuật toán cắt ô, tìm Bounding Box và căn chỉnh điểm neo chân chạm đất.',
    iconName: 'Image',
    articles: [
      {
        id: 'bounding-box-anchor',
        title: 'Thuật toán tìm Bounding Box & Căn chỉnh tâm neo',
        summary: 'Tự động loại bỏ viền trong suốt và neo gót chân nhân vật tại Origin (0, 0).',
        blocks: [
          {
            type: 'paragraph',
            content: 'Trong màn hình **Xử lý ảnh (Workspace)**, hệ thống sử dụng thư viện **NumPy & Pillow** để phân tích kênh Alpha (độ trong suốt) của ảnh, xác định chính xác hộp bao chữ nhật nhỏ nhất ôm trọn nhân vật.'
          },
          {
            type: 'steps',
            title: 'Các bước tính toán thuật toán:',
            items: [
              {
                step: 1,
                title: 'Quét mảng điểm ảnh (Alpha Thresholding)',
                desc: 'Lọc bỏ tất cả pixel có độ trong suốt nhỏ hơn 10%.'
              },
              {
                step: 2,
                title: 'Xác định tọa độ cực trị [MinX, MinY, MaxX, MaxY]',
                desc: 'Tìm điểm cao nhất của đầu và điểm thấp nhất của gót chân.'
              },
              {
                step: 3,
                title: 'Căn chỉnh điểm neo chân (Origin 0,0)',
                desc: 'Đặt tâm chân của nhân vật vào chính giữa trục X ở mép đáy của ô hình, giúp mọi frame khi lặp lại đều đứng cố định trên mặt đất.'
              }
            ]
          },
          {
            type: 'callout',
            level: 'info',
            title: 'Khả năng xuất đa định dạng',
            content: 'Sau khi xử lý, bạn có thể tải về từng frame đơn lẻ dạng PNG trong suốt hoặc tải toàn bộ bộ ảnh nén dưới dạng file ZIP.'
          }
        ]
      }
    ]
  },
  {
    id: 'godot-engine',
    title: 'Thử nghiệm Godot & Xuất game',
    description: 'Kiểm tra nhịp chạy hoạt họa, so sánh tỉ lệ và xuất SpriteFrames .tres.',
    iconName: 'Gamepad2',
    articles: [
      {
        id: 'godot-testbed',
        title: 'Phòng thử nghiệm hoạt họa Godot Testbed',
        summary: 'Điều khiển di chuyển nhân vật bằng phím A/D/Space và so sánh tỉ lệ pixel.',
        blocks: [
          {
            type: 'paragraph',
            content: '**Godot Testbed** mô phỏng chân thực môi trường vật lý 2D của Godot Engine 4 ngay trên trình duyệt web.'
          },
          {
            type: 'table',
            title: 'Phím tắt điều khiển nhân vật thử nghiệm:',
            headers: ['Phím bấm', 'Hành động mô phỏng', 'Ghi chú'],
            rows: [
              ['A hoặc Mũi tên trái (←)', 'Di chuyển sang trái', 'Tự động lật hướng sprite (Flip H)'],
              ['D hoặc Mũi tên phải (→)', 'Di chuyển sang phải', 'Chạy hoạt họa bước đi (Walk loop)'],
              ['Space (Phím cách)', 'Nhảy lên (Jump)', 'Mô phỏng gia tốc trọng lực gravity = 980'],
              ['J hoặc Chuột trái', 'Tấn công (Attack)', 'Chạy 3 frame chém vũ khí'],
              ['K hoặc Chuột phải', 'Trúng đòn (Hurt)', 'Chớp đỏ và giật lùi quán tính']
            ]
          },
          {
            type: 'code',
            language: 'gdscript',
            title: 'Cấu trúc tệp SpriteFrames .tres xuất ra cho Godot 4:',
            code: `[gd_resource type="SpriteFrames" format=3]

[resource]
animations = [{
"frames": [{
"duration": 1.0,
"texture": SubResource("AtlasTexture_01")
}, {
"duration": 1.0,
"texture": SubResource("AtlasTexture_02")
}],
"loop": true,
"name": &"walk",
"speed": 8.0
}]`
          },
          {
            type: 'callout',
            level: 'tip',
            title: 'Tải Map nền tùy chỉnh',
            content: 'Bạn có thể kéo thả một bức ảnh phong cảnh rừng rậm, lâu đài hoặc hầm ngục vào để xem nhân vật đứng trên sàn đất thực tế.'
          }
        ]
      }
    ]
  },
  {
    id: 'account-security',
    title: 'Hồ sơ & Tài khoản',
    description: 'Đổi ảnh đại diện, chỉnh sửa thông tin cá nhân và quản trị phân quyền.',
    iconName: 'Users',
    articles: [
      {
        id: 'profile-modal-guide',
        title: 'Chỉnh sửa Hồ sơ & Đổi ảnh đại diện',
        summary: 'Nhấp chuột vào ảnh đại diện ở đáy Sidebar để mở hộp thoại cài đặt.',
        blocks: [
          {
            type: 'paragraph',
            content: 'Bạn có thể tùy biến thông tin cá nhân của mình bất kỳ lúc nào bằng cách nhấp chuột trực tiếp vào **Ảnh đại diện** ở góc dưới cùng bên trái thanh Sidebar.'
          },
          {
            type: 'steps',
            title: 'Các tính năng trong hộp thoại Hồ sơ cá nhân:',
            items: [
              {
                step: 1,
                title: 'Đổi ảnh đại diện từ máy tính',
                desc: 'Chọn file ảnh PNG, JPG hoặc WebP (tối đa 4MB). Ảnh sẽ được nén Base64 và lưu vĩnh viễn trong CSDL MySQL.'
              },
              {
                step: 2,
                title: 'Sửa Họ, Tên đệm và Tên',
                desc: 'Họ tên sẽ được cập nhật tự động hiển thị trên thanh điều hướng.'
              },
              {
                step: 3,
                title: 'Đổi tên tài khoản Gmail',
                desc: 'Hệ thống tự động kiểm tra định dạng @gmail.com và kiểm tra chống trùng lặp với người dùng khác.'
              },
              {
                step: 4,
                title: 'Đổi mật khẩu an toàn',
                desc: 'Cần nhập chính xác mật khẩu hiện tại trước khi đặt mật khẩu mới.'
              }
            ]
          }
        ]
      }
    ]
  }
];
